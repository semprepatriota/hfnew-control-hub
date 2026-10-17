"""Create a numbered contact sheet without modifying the supplied videos."""
import json
from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageDraw

source = Path(sys.argv[1])
output = Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=True)
files = sorted(source.glob("*.mp4"))
sheet = Image.new("RGB", (300 * 5, 570 * 2), "#202020")
draw = ImageDraw.Draw(sheet)
report = []
for index, video in enumerate(files):
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)
    ]))
    stream = next(item for item in probe["streams"] if item["codec_type"] == "video")
    duration = float(probe["format"]["duration"])
    frame = output / f"source-{index + 1:02d}.jpg"
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(min(duration / 2, 0.7)),
        "-i", str(video), "-frames:v", "1", "-vf", "scale=280:500:force_original_aspect_ratio=decrease", str(frame)
    ], check=True)
    image = Image.open(frame)
    x, y = (index % 5) * 300, (index // 5) * 570
    sheet.paste(image, (x + 10, y + 10))
    draw.text((x + 10, y + 515), f"{index + 1:02d} | {duration:.3f}s", fill="white")
    draw.text((x + 10, y + 535), video.name[:35], fill="white")
    report.append({"index": index + 1, "file": str(video), "duration": duration,
                   "width": stream["width"], "height": stream["height"],
                   "fps": stream["r_frame_rate"], "audio": any(s["codec_type"] == "audio" for s in probe["streams"])})
sheet.save(output / "contact-sheet.jpg")
(output / "sources.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
