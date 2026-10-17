"""Replace one counter while keeping the existing frame-accurate timeline."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tarfile

repo = Path(__file__).resolve().parent.parent
backend = Path(sys.argv[1]).resolve()
source = Path(sys.argv[2]).resolve()
root = backend / "assets/top10/counters"
relative = "assets/top10/counters/pink3d/03.mp4"
target = backend / relative
old_hash = json.loads((repo / "deploy/top10/manifest.json").read_text())[relative]
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
before = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in root.glob("*/*.mp4")}
catalog = json.loads((root / "manifest.json").read_text())
frames = catalog["models"]["pink3d"]["frames_by_rank"].get("3", catalog["models"]["pink3d"]["frames"])
temporary = target.with_name("03.corrected.mp4")
subprocess.run([
    "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-threads", "1", "-i", str(source),
    "-vf", "setpts=PTS-STARTPTS,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=0.1",
    "-af", f"asetpts=PTS-STARTPTS,aresample=48000,apad,atrim=duration={frames / 30:.9f}",
    "-map", "0:v:0", "-map", "0:a:0", "-frames:v", str(frames), "-t", f"{frames / 30:.9f}",
    "-c:v", "libx264", "-threads", "2", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(temporary)
], check=True, timeout=60)
probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(temporary)]))
video = next(s for s in probe["streams"] if s["codec_type"] == "video")
assert int(video["nb_frames"]) == frames
assert (video["width"], video["height"], video["pix_fmt"]) == (1080, 1920, "yuv420p")
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-threads", "1", "-i", str(temporary), "-f", "null", "-"], check=True, timeout=30)
temporary.replace(target)
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
for name, digest in before.items():
    if name != "pink3d/03.mp4":
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
catalog["revision"] = hashlib.sha256(b"".join(p.read_bytes() for p in sorted(root.glob("*/*.mp4")))).hexdigest()[:16]
(root / "manifest.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
(repo / "src/modules/top10/counter-catalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
provenance = {"source_file": source.name, "source_sha256": source_hash, "frames": frames,
              "output_sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
              "timing_note": "Last frame held for one extra frame to preserve the existing timeline."}
(root / "pink-three-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
stage = Path(sys.argv[3]).resolve()
stage.mkdir(parents=True, exist_ok=True)
files = [relative, "assets/top10/counters/manifest.json", "assets/top10/counters/pink-three-provenance.json"]
import shutil
manifest = {}
for name in files:
    dest = stage / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(backend / name, dest)
    manifest[name] = hashlib.sha256(dest.read_bytes()).hexdigest()
(stage / "patch.json").write_text(json.dumps({"previous_counter_sha256": old_hash, "files": manifest}, indent=2) + "\n")
shutil.copy2(repo / "deploy/top10/update-counter3.py", stage / "update-counter3.py")
with tarfile.open(stage.parent / "top10-counter3.tar.gz", "w:gz") as output:
    output.add(stage, arcname="counter3")
print(f"COUNTER3_LOCAL=OK\nOTHER_COUNTERS=UNCHANGED\nREVISION={catalog['revision']}")
