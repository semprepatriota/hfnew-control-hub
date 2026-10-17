"""Run the installed scene detector outside the shared API process."""

import argparse
from collections import deque
import json
import os
import time

DETECTION_PROFILE = "pyscenedetect_content_adaptive_motion_guard_v2"


def refine_hard_cut_frame(history, candidate: int) -> int:
    """Move an accepted boundary only onto an isolated, unambiguous hard jump."""
    import numpy as np

    scores = []
    for (before_time, before), (after_time, after) in zip(history, history[1:]):
        if after_time.get_frames() != before_time.get_frames() + 1:
            continue
        score = float(np.abs(after.astype(np.int16) - before.astype(np.int16)).mean())
        scores.append((after_time.get_frames(), score))
    if not scores:
        return candidate
    strongest = sorted(scores, key=lambda value: value[1], reverse=True)
    frame, peak = strongest[0]
    current = next((score for number, score in scores if number == candidate), 0)
    runner_up = strongest[1][1] if len(strongest) > 1 else 0
    # Fades and paired flash peaks are ambiguous: retain their approved boundary.
    if peak >= 30 and current < peak * .35 and runner_up < peak * .6:
        return frame
    return candidate


def _same_camera_view(before, after) -> bool:
    import cv2
    import numpy as np

    first_gray = cv2.cvtColor(before, cv2.COLOR_BGR2GRAY)
    last_gray = cv2.cvtColor(after, cv2.COLOR_BGR2GRAY)
    height, width = before.shape[:2]
    window = cv2.createHanningWindow((width, height), cv2.CV_32F)
    shift, confidence = cv2.phaseCorrelate(first_gray.astype(np.float32), last_gray.astype(np.float32), window)
    if min(float(first_gray.std()), float(last_gray.std())) >= 5.0 and confidence >= 0.75 \
            and abs(shift[0]) < width * 0.2 and abs(shift[1]) < height * 0.2:
        return True
    orb = cv2.ORB_create(nfeatures=300, edgeThreshold=9, patchSize=19, fastThreshold=10)
    first_points, first_descriptors = orb.detectAndCompute(first_gray, None)
    last_points, last_descriptors = orb.detectAndCompute(last_gray, None)
    if first_descriptors is None or last_descriptors is None or min(len(first_points), len(last_points)) < 20:
        return False
    pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(first_descriptors, last_descriptors, k=2)
    matches = [pair[0] for pair in pairs if len(pair) == 2 and pair[0].distance < 0.75 * pair[1].distance]
    if len(matches) < max(20, min(len(first_points), len(last_points)) * 0.15):
        return False
    first = np.float32([first_points[match.queryIdx].pt for match in matches])
    last = np.float32([last_points[match.trainIdx].pt for match in matches])
    transform, inliers = cv2.estimateAffinePartial2D(first, last, method=cv2.RANSAC, ransacReprojThreshold=2.0)
    if transform is None or inliers is None or float(inliers.mean()) < 0.85:
        # Drone footage changes perspective across the ground plane; a partial
        # affine model would falsely split this continuous motion into many cuts.
        transform, inliers = cv2.findHomography(first, last, cv2.RANSAC, 3.0)
        if transform is None or inliers is None or float(inliers.mean()) < 0.70:
            return False
    retained = first[inliers.ravel().astype(bool)]
    # A small matching corner or stationary watermark must not suppress a cut.
    retained_last = last[inliers.ravel().astype(bool)]
    return all(float(np.ptp(points[:, 0])) >= width * 0.35 and float(np.ptp(points[:, 1])) >= height * 0.35
               for points in (retained, retained_last))


def _motion_guarded_detector(fps: float, threshold: float):
    from scenedetect import AdaptiveDetector, ContentDetector, HashDetector, HistogramDetector, SceneDetector

    class MotionGuardDetector(SceneDetector):
        def __init__(self):
            super().__init__()
            self.stride = max(1, round(fps * 0.25))
            self.context = max(1, round(fps * 0.25))
            self.primary = AdaptiveDetector(
                adaptive_threshold=max(1.2, min(threshold * 10, 7.5)),
                min_content_val=5.0, min_scene_len="0.75s",
            )
            # Wider temporal comparisons recover dissolves without lowering the
            # per-frame noise floor. Both passes use the same visual confirmation.
            self.temporal = AdaptiveDetector(
                adaptive_threshold=max(1.2, min(threshold * 5, 3.75)),
                min_content_val=15.0, min_scene_len="0.75s",
            )
            self.history = deque(maxlen=2 * self.stride + 2 * self.context + 5)
            self.pending = {}
            self.seen = set()
            self.candidates = 0
            self.rejected = 0
            self.refinements = {}

        @property
        def event_buffer_length(self):
            return 2 * self.stride + self.context + 1

        def _confirmed(self, flush=False):
            cuts = []
            latest = self.history[-1][0].get_frames()
            for frame_num, candidate in sorted(tuple(self.pending.items())):
                if not flush and latest < frame_num + self.context:
                    continue
                del self.pending[frame_num]
                before = next((item for item in reversed(self.history)
                               if item[0].get_frames() <= frame_num - self.context), self.history[0])
                after = next((item for item in self.history
                              if item[0].get_frames() >= frame_num + self.context), self.history[-1])
                content = ContentDetector(threshold=15.0, min_scene_len=0)
                structure = HashDetector(threshold=0.15, min_scene_len=0)
                # Histogram confirmation also preserves cuts between plain colour
                # cards, whose grayscale perceptual hashes can be identical.
                histogram = HistogramDetector(threshold=0.30, min_scene_len=0)
                for detector in (content, structure, histogram):
                    detector.process_frame(*before)
                changed_content = content.process_frame(*after)
                changed_structure = structure.process_frame(*after)
                changed_histogram = histogram.process_frame(*after)
                if changed_content and (changed_structure or changed_histogram) and not _same_camera_view(before[1], after[1]):
                    window = [item for item in self.history if frame_num-self.stride-1 <= item[0].get_frames() <= frame_num+self.stride]
                    refined = refine_hard_cut_frame(window, frame_num)
                    if refined != frame_num:
                        self.refinements[frame_num] = refined
                    cuts.append(candidate)
                else:
                    self.rejected += 1
            return cuts

        def process_frame(self, timecode, frame_img):
            self.history.append((timecode, frame_img.copy()))
            candidates = self.primary.process_frame(timecode, frame_img)
            if timecode.get_frames() % self.stride == 0:
                candidates += self.temporal.process_frame(timecode, frame_img)
            for candidate in candidates:
                frame_num = candidate.get_frames()
                if frame_num not in self.seen:
                    self.seen.add(frame_num)
                    self.pending[frame_num] = candidate
                    self.candidates += 1
            return self._confirmed()

        def post_process(self, timecode):
            return self._confirmed(flush=True) if self.history else []

    return MotionGuardDetector()


def detect(source: str, threshold: float, duration: float) -> dict:
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "threads;1"
    import cv2
    from scenedetect import SceneDetector, SceneManager, open_video

    cv2.setNumThreads(1)
    last_report = 0.0

    class ProgressDetector(SceneDetector):
        def process_frame(self, timecode, frame_img):
            nonlocal last_report
            now = time.monotonic()
            if now - last_report >= 1:
                print(f"out_time_us={int(timecode.get_seconds() * 1_000_000)}", flush=True)
                last_report = now
            return []

    video = open_video(source)
    manager = SceneManager()
    manager.auto_downscale = False
    manager.downscale = max(1, int(video.frame_size[0] / 320))
    detector = _motion_guarded_detector(float(video.frame_rate), threshold)
    manager.add_detector(ProgressDetector())
    manager.add_detector(detector)
    frames = manager.detect_scenes(video=video, show_progress=False, frame_skip=0)
    decoded_seconds = frames / float(video.frame_rate)
    if frames <= 0 or decoded_seconds < duration - 2:
        raise RuntimeError("O detector nao conseguiu ler o video completo")
    scenes = manager.get_scene_list(start_in_scene=True)
    return {
        "boundaries": [start.get_seconds() for start, _ in scenes[1:]],
        "decoded_frames": frames,
        "decoded_seconds": round(decoded_seconds, 3),
        "engine": DETECTION_PROFILE,
        "candidate_count": detector.candidates,
        "rejected_candidates": detector.rejected,
        "boundary_refinements": [{'candidate': original/float(video.frame_rate), 'refined': refined/float(video.frame_rate)}
                                 for original,refined in sorted(detector.refinements.items())],
        "boundary_precision": "hard_cut_frame_refinement_v1",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("--threshold", type=float, required=True)
    parser.add_argument("--duration", type=float, required=True)
    args = parser.parse_args()
    result = detect(args.source, args.threshold, args.duration)
    print("SCENE_RESULT=" + json.dumps(result), flush=True)
