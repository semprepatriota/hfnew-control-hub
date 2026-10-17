"""Normalize the verified original Cinema counters; never edit source files."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

source = Path(sys.argv[1]).resolve()
backend = Path(sys.argv[2]).resolve()
repo = Path(__file__).resolve().parent.parent
mapping = {
    10: "cena_001_Reportagem_extra_da_344f22.mp4",
    9: "9 (1).mp4",
    8: "cena_003_Reportagem_extra_da_a1405f.mp4",
    7: "7.mp4",
    6: "6.mp4",
    5: "5.mp4",
    4: "cena_007_Reportagem_extra_da_3247de.mp4",
    3: "cena_008_Reportagem_extra_da_a24d08.mp4",
    2: "cena_009_Reportagem_extra_da_3b4273.mp4",
    1: "cena_010_Reportagem_extra_da_de4e23.mp4",
}
root = backend / "assets/top10/counters"
catalog = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
film = {"label": "Cinema original", "frames": 30, "frames_by_rank": {}}
provenance = {}
for rank, filename in mapping.items():
    original = source / filename
    original_hash = hashlib.sha256(original.read_bytes()).hexdigest()
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-of", "json", str(original)
    ]))
    video = next(s for s in probe["streams"] if s["codec_type"] == "video")
    frames = int(video["nb_frames"])
    duration = frames / 30
    target = root / "film" / f"{rank:02d}.mp4"
    subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(original),
        "-vf", "setpts=PTS-STARTPTS,scale=1080:1920:flags=lanczos,setsar=1,fps=30",
        "-af", f"asetpts=PTS-STARTPTS,aresample=48000,apad,atrim=duration={duration:.9f}",
        "-map", "0:v:0", "-map", "0:a:0", "-frames:v", str(frames), "-t", f"{duration:.9f}",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(target)
    ], check=True, timeout=90)
    checked = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-of", "json", str(target)
    ]))
    output_video = next(s for s in checked["streams"] if s["codec_type"] == "video")
    assert int(output_video["nb_frames"]) == frames
    assert output_video["width"] == 1080 and output_video["height"] == 1920
    assert hashlib.sha256(original.read_bytes()).hexdigest() == original_hash
    film["frames_by_rank"][str(rank)] = frames
    provenance[str(rank)] = {"source_file": filename, "source_sha256": original_hash,
                             "output_sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "frames": frames}
    print(f"CINEMA_ORIGINAL={rank} | FRAMES={frames}", flush=True)
catalog["models"]["pink3d"]["label"] = "3D Impacto"
catalog["models"]["film"] = film
if len(sys.argv) > 3:
    original = Path(sys.argv[3]).resolve()
    original_hash = hashlib.sha256(original.read_bytes()).hexdigest()
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", str(original)
    ]))
    frames = int(probe["streams"][0]["nb_frames"])
    target = root / "pink3d/07.mp4"
    subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(original),
        "-vf", "setpts=PTS-STARTPTS,scale=1080:1920:flags=lanczos,setsar=1,fps=30",
        "-af", f"asetpts=PTS-STARTPTS,aresample=48000,apad,atrim=duration={frames / 30:.9f}",
        "-map", "0:v:0", "-map", "0:a:0", "-frames:v", str(frames), "-t", f"{frames / 30:.9f}",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(target)
    ], check=True, timeout=90)
    assert hashlib.sha256(original.read_bytes()).hexdigest() == original_hash
    (root / "pink-seven-provenance.json").write_text(json.dumps({
        "source_file": original.name, "source_sha256": original_hash,
        "output_sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "frames": frames
    }, indent=2) + "\n", encoding="utf-8")
    print(f"PINK_CORRECTED=7 | FRAMES={frames}", flush=True)
pink_timings = {}
for rank in range(10, 0, -1):
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames", "-of", "json", str(root / "pink3d" / f"{rank:02d}.mp4")
    ]))
    frames = int(probe["streams"][0]["nb_frames"])
    if frames != catalog["models"]["pink3d"]["frames"]:
        pink_timings[str(rank)] = frames
catalog["models"]["pink3d"]["frames_by_rank"] = pink_timings
catalog["revision"] = hashlib.sha256(b"".join(path.read_bytes() for path in sorted(root.glob("*/*.mp4")))).hexdigest()[:16]
(root / "manifest.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
(repo / "src/modules/top10/counter-catalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
(root / "film-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
print("CINEMA_ORIGINAL_IMPORT=OK")
