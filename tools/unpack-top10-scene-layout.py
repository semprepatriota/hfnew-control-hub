"""Render the diagnostic frames locally; never touch original videos or projects."""
import base64
import io
import json
from pathlib import Path
from PIL import Image, ImageDraw

root=Path(r'E:\HFNEW-TOP10-TOOLS\headline-verification')
source=max(root.glob('live-layout-*.txt'),key=lambda p:p.stat().st_mtime)
line=next(line for line in source.read_text(encoding='utf-8-sig').splitlines() if line.startswith('TOP10_LAYOUT_JSON='))
data=json.loads(line.partition('=')[2])
sheet=Image.new('RGB',(1350,504*len(data['scenes'])),'#121212')
draw=ImageDraw.Draw(sheet)
good=0
for row,scene in enumerate(data['scenes']):
    for column,frame in enumerate(scene['frames']):
        x,y=column*270,row*504
        draw.text((x+4,y+5),f"Cena {scene['rank']} | {frame['seconds']:.2f}s",fill='white')
        if frame.get('jpeg'):
            try:
                image=Image.open(io.BytesIO(base64.b64decode(frame.pop('jpeg')))).convert('RGB')
                image.save(root/f"scene-{scene['rank']:02d}-{column}.jpg",quality=95)
                sheet.paste(image.resize((270,480)),(x,y+24));good+=1
            except Exception as exc:
                frame['error']=str(exc)
        else:draw.text((x+4,y+50),'QUADRO INDISPONIVEL',fill='red')
sheet.save(root/'live-scenes-contact.jpg',quality=90)
(root/'live-scenes-report.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'project':data['title'],'scenes':len(data['scenes']),'frames_ok':good,'image':str(root/'live-scenes-contact.jpg')},ensure_ascii=False))
