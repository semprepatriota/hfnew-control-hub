"""Compare only TOP 10 band padding against the approved original headline painter."""
from pathlib import Path
import json
import runpy
import subprocess
import sys
import tempfile
from unittest.mock import patch

from PIL import Image, ImageChops, ImageDraw, ImageOps, ImageStat

repo = Path(__file__).resolve().parents[1]
sys.path.insert(0, r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
from config import settings
from services import top10_service as studio
from services.top10_headline_service import HeadlineConfig, headline_image

old = runpy.run_path(str(repo / 'deploy/top10/backend/services/top10_headline_service.py'))['headline_image']
folder = Path(r'E:\HFNEW-TOP10-TOOLS\compact-headline')
folder.mkdir(exist_ok=True)
reference = Path(r'E:\HFNEW-TOP10-TOOLS\headline-verification')
record = json.loads((reference / 'verified-caption-layout.json').read_text())[0]
h = HeadlineConfig(**record['headline'])
with tempfile.TemporaryDirectory(dir=folder) as temporary, patch.object(studio, 'project_root', return_value=Path(temporary)):
    (Path(temporary) / 'files').mkdir()
    before = old('test', h)
    after = headline_image('test', h)
    before_path = Path(temporary) / 'files' / before['filename']
    after_path = Path(temporary) / 'files' / after['filename']
    a, b = Image.open(before_path).convert('RGBA'), Image.open(after_path).convert('RGBA')
    glyphs = lambda image: ImageChops.multiply(ImageOps.invert(image.convert('L')), image.getchannel('A'))
    assert ImageChops.difference(glyphs(a), glyphs(b)).getbbox() is None, 'Text pixels moved or changed'
    assert before['applied_font_size'] == after['applied_font_size']
    sheet = Image.new('RGB', (720, 664), '#171717')
    for index, (band, title) in enumerate([(a, 'Antes'), (b, 'Depois: somente fundo menor')]):
        frame = Image.open(reference / 'scene-10-2.jpg').convert('RGB').resize((1080, 1920))
        frame.paste(band, (round(h.x * 1080), round(h.y * 1920)), band)
        frame.save(folder / f'{index}-preview.png')
        sheet.paste(frame.resize((360, 640)), (index * 360, 24))
        ImageDraw.Draw(sheet).text((index * 360 + 5, 5), title, fill='white')
    sheet.save(folder / 'antes-depois.jpg', quality=95)
    output = folder / 'compact-headline.mp4'
    decoded = folder / 'rendered.png'
    subprocess.run([settings.FFMPEG_BIN, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-loop', '1',
        '-i', str(reference / 'scene-10-2.jpg'), '-loop', '1', '-i', str(after_path), '-filter_complex_threads', '1',
        '-filter_complex', f'[0:v]scale=1080:1920[base];[base][1:v]overlay=x=0:y={round(h.y*1920)}:format=auto[out]',
        '-map', '[out]', '-t', '0.2', '-an', '-threads', '1', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', str(output)], check=True, timeout=30)
    subprocess.run([settings.FFMPEG_BIN, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(output),
        '-frames:v', '1', str(decoded)], check=True, timeout=20)
    region = (0, round(h.y*1920), 1080, round(h.y*1920) + b.height)
    error = ImageStat.Stat(ImageChops.difference(Image.open(folder/'1-preview.png').crop(region), Image.open(decoded).convert('RGB').crop(region))).mean
    assert max(error) < 3, error
    print(f'WHITE_BAND_HEIGHT={a.height}->{b.getchannel("A").getbbox()[3]-b.getchannel("A").getbbox()[1]}')
    print('TEXT_PIXELS=UNCHANGED\nPNG_AND_H264=OK')
    print(f'COMPARISON={folder / "antes-depois.jpg"}')
