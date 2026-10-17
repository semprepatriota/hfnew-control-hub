"""Review motion scores around existing scene boundaries; does not change the detector."""
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

root=Path(r'E:\HFNEW-FORGE-MAX-PRECISION')
audit=json.loads(max(root.glob('*/audit.json'),key=lambda p:p.stat().st_mtime).read_text())
video=audit['videos'][0]
source=Path(r'E:\CANAL HFNEW - IMAGENS')/video['original_name']
cv2.setNumThreads(1)
capture=cv2.VideoCapture(str(source))
fps=capture.get(cv2.CAP_PROP_FPS)
positions=[round(scene['start_seconds']*fps) for scene in video['scenes'][1:]]
needed={n for cut in positions for n in range(max(0,cut-10),cut+11)}
frames={};scores={};previous=None;index=0
while True:
    success,image=capture.read()
    if not success: break
    image=cv2.resize(image,(96,170),interpolation=cv2.INTER_AREA)
    if index in needed: frames[index]=image.copy()
    if previous is not None: scores[index]=float(np.abs(image.astype(float)-previous.astype(float)).mean())
    previous=image;index+=1
capture.release()
rows=[]
for cut in positions:
    nearby=[n for n in range(max(1,cut-8),cut+9) if n in scores]
    peak=max(nearby,key=lambda n:scores[n])
    ratio=scores.get(cut,0)/max(scores[peak],.01)
    rows.append({'frame':cut,'peak_frame':peak,'shift':peak-cut,'score':scores.get(cut,0),'peak_score':scores[peak],'ratio':ratio})
suspects=[row for row in rows if abs(row['shift'])>=2 and row['ratio']<.4 and row['peak_score']>10]
sheet=Image.new('RGB',(720,324*max(1,len(suspects))),'#141414');draw=ImageDraw.Draw(sheet)
for row,record in enumerate(suspects):
    moments=[record['peak_frame']-1,record['peak_frame'],record['frame']-1,record['frame']]
    for column,n in enumerate(moments):
        frame=Image.fromarray(cv2.cvtColor(frames[n],cv2.COLOR_BGR2RGB)).resize((180,300))
        sheet.paste(frame,(column*180,row*324+24))
        draw.text((column*180+3,row*324+4),f'Frame {n} | {n/fps:.3f}s',fill='white')
sheet.save(root/'transition-position-suspects.jpg',quality=94)
(root/'transition-position-review.json').write_text(json.dumps({'boundaries':rows,'suspects':suspects},indent=2))
print(json.dumps({'boundaries':len(rows),'suspects':suspects}))
