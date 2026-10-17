import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from PIL import Image
from config import settings
from services import top10_service as studio
from services.top10_logo_service import logo_overlay, validate_logo_video
from utils.user_context import set_current_user, reset_current_user
from utils.workspace_storage import write_json_atomic


class LogoTests(unittest.TestCase):
    def test_validation(self):
        good = dict(duration=5, width=720, height=720, video_codec='h264')
        validate_logo_video(SimpleNamespace(**good))
        for change in ({'duration': 0}, {'duration': 31}, {'width': 2880}, {'video_codec': 'hevc'}):
            with self.assertRaises(HTTPException):
                validate_logo_video(SimpleNamespace(**{**good, **change}))

    def test_inputs_and_global_loop_phase(self):
        config = studio.Top10Config()
        logo = dict(filename='logo.mp4', width=720, height=720, animated=True, duration=5)
        inputs, filters = logo_overlay(logo, config, Path('/tmp'), 3, 'v', 195, 30, 1080, 1920)
        self.assertIn('-stream_loop', inputs)
        self.assertIn('1.500000', inputs)
        self.assertIn('overlay=853:117', filters[-1])
        inputs, _ = logo_overlay({**logo, 'animated': False}, config, Path('/tmp'), 3, 'v', 0, 30, 1080, 1920)
        self.assertIn('-loop', inputs)
        self.assertNotIn('-stream_loop', inputs)

    @unittest.skipUnless(os.getenv('TOP10_LOGO_SMOKE') == '1', 'Explicit media smoke only')
    def test_real_upload_render_loop_and_workspace_isolation(self):
        artifact = Path(os.environ['TOP10_LOGO_ARTIFACT']).resolve()
        artifact.mkdir(parents=True, exist_ok=True)
        storage = settings.STORAGE_DIR
        settings.STORAGE_DIR = str(artifact / 'storage')
        token = set_current_user({'role': 'guest', 'workspace_type': 'personal', 'storage_scope': 'top10_logo_qa'})
        try:
            project = studio.create_project('Logo QA')
            root = studio.project_root(project['id'])
            logo_path = root / 'files' / 'logo.mp4'
            shutil.copyfile(os.environ['TOP10_LOGO_FILE'], logo_path)
            project = studio.add_asset(project['id'], logo_path, 'logo', 'Falcao Zoeira.mp4', None)
            self.assertTrue(project['assets'][project['logo']]['animated'])
            self.assertTrue(project['config']['logo_enabled'])
            video = root / 'files' / 'scene.mp4'
            subprocess.run([settings.FFMPEG_BIN, '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x2277bb:s=360x640:r=30:d=6',
                            '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                            '-c:a', 'aac', '-y', str(video)], check=True, timeout=30)
            project = studio.add_asset(project['id'], video, 'video', 'scene.mp4', 0)
            data = studio.read_project(project['id'])
            job = root / 'jobs' / ('job_' + 'a' * 24 + '.json')
            write_json_atomic(job, {'status': 'running', 'cancel_requested': False})
            result = studio.render_project(data, job)
            output = root / 'renders' / result['filename']
            shutil.copyfile(output, artifact / 'top10-logo-smoke.mp4')
            (artifact / 'project.json').write_text(json.dumps(studio.public_project(studio.read_project(project['id']))), encoding='utf-8')
            self.assertGreater(result['duration'], 6)
            self.assertEqual(studio.probe_media(output).audio_codec, 'aac')
            # Compare actual exported logo at times before/after the loop and a scene boundary.
            for t in (.6, 2.4, 5.6, 6.2):
                expected = artifact / f'expected-{t}.png'
                actual = artifact / f'actual-{t}.png'
                subprocess.run([settings.FFMPEG_BIN, '-v', 'error', '-ss', str(t % 5), '-i', str(logo_path),
                    '-frames:v', '1', '-vf', 'scale=151:151', '-y', str(expected)], check=True, timeout=20)
                subprocess.run([settings.FFMPEG_BIN, '-v', 'error', '-ss', str(t), '-i', str(output),
                    '-frames:v', '1', '-vf', 'crop=151:151:853:117:exact=1', '-y', str(actual)], check=True, timeout=20)
                import numpy as np
                a, b = np.asarray(Image.open(actual).convert('RGB'), dtype=float), np.asarray(Image.open(expected).convert('RGB'), dtype=float)
                error = abs(a - b).mean()
                print(f'LOGO_FRAME_{t}_MAE={error:.2f}', flush=True)
                self.assertLess(error, 12)
            other = set_current_user({'role': 'guest', 'workspace_type': 'personal', 'storage_scope': 'top10_logo_other'})
            try:
                with self.assertRaises(HTTPException): studio.read_project(project['id'])
            finally:
                reset_current_user(other)
            studio.delete_asset(project['id'], project['logo'])
            self.assertFalse(logo_path.exists())
        finally:
            reset_current_user(token)
            settings.STORAGE_DIR = storage


if __name__ == '__main__':
    unittest.main()
