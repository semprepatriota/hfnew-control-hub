"""Compare original audit frames and actual H.264 captions in disposable local storage."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageChops, ImageDraw, ImageStat

sys.path.insert(0, r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
from config import settings
from services import top10_service as studio
from services.top10_headline_service import HeadlineConfig, headline_image
from utils.user_context import set_current_user

root=Path(r'E:\HFNEW-TOP10-TOOLS\headline-verification')
rows=json.loads((root/'verified-caption-layout.json').read_text())
sheet=Image.new('RGB',(810,504*len(rows)),'#161616')
draw=ImageDraw.Draw(sheet)
set_current_user({'role':'owner','workspace_type':'internal','storage_scope':'legacy_owner'})
old_storage=settings.STORAGE_DIR
try:
    with tempfile.TemporaryDirectory(prefix='caption-render-',dir=root) as temporary:
        settings.STORAGE_DIR=temporary
        project=studio.create_project('Disposable caption comparison')
        for row,record in enumerate(rows):
            h=HeadlineConfig(**record['headline'])
            png=headline_image(project['id'],h)
            overlay=studio.project_root(project['id'])/'files'/png['filename']
            with Image.open(root/f"scene-{record['rank']:02d}-2.jpg") as source:
                expected=source.convert('RGB').resize((1080,1920))
            x,y=round(h.x*1080),round(h.y*1920)
            with Image.open(overlay) as band:
                expected.paste(band,(x,y),band)
            expected_path=Path(temporary)/'expected.png'
            expected.save(expected_path)
            video=root/f"caption-check-{record['rank']:02d}.mp4"
            decoded=Path(temporary)/'decoded.png'
            subprocess.run([settings.FFMPEG_BIN,'-hide_banner','-loglevel','error','-y','-loop','1','-i',str(root/f"scene-{record['rank']:02d}-2.jpg"),
                '-loop','1','-i',str(overlay),'-filter_complex_threads','1','-filter_complex',f'[0:v]scale=1080:1920[base];[base][1:v]overlay=x={x}:y={y}:format=auto[out]',
                '-map','[out]','-t','0.2','-an','-threads','1','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',str(video)],check=True,timeout=30)
            subprocess.run([settings.FFMPEG_BIN,'-hide_banner','-loglevel','error','-y','-i',str(video),'-frames:v','1',str(decoded)],check=True,timeout=20)
            with Image.open(decoded) as rendered:
                rendered=rendered.convert('RGB')
                region=(x,y,x+png['width'],y+png['height'])
                error=ImageStat.Stat(ImageChops.difference(expected.crop(region),rendered.crop(region))).mean
                if max(error)>3: raise AssertionError(f"Caption codec mismatch: {error}")
                for column,(image,label) in enumerate([(Image.open(root/f"scene-{record['rank']:02d}-2.jpg"),'Original'),(expected,'PNG / preview'),(rendered,'H.264')]):
                    sheet.paste(image.resize((270,480)),(column*270,row*504+24))
                    draw.text((column*270+4,row*504+5),f"Cena {record['rank']} | {label}",fill='white')
            print(f"SCENE_{record['rank']}_H264=OK",flush=True)
finally:
    settings.STORAGE_DIR=old_storage
sheet.save(root/'caption-original-preview-render.jpg',quality=92)
print('CAPTION_VISUAL_COMPARISON=OK')
