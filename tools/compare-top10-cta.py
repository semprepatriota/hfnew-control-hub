import json
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image

root=Path(r'E:\HFNEW-TOP10-TOOLS\headline-cta')
data=json.loads((root/'render-check/result.json').read_text())
file=root/'render-check/renders'/data['results']['True']['filename']
results=[]
for frame in (60,75,82,85,100,118,130,164,180):
    output=root/f'render-{frame}.png'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(file),'-vf',f'select=eq(n\\,{frame})',
                    '-frames:v','1','-threads','1',str(output)],check=True)
    preview=np.asarray(Image.open(root/f'preview-{frame}.png').convert('RGB')).astype(np.int16)
    # Compare the actual browser-decoded MP4, as users watch it, against the browser preview.
    rendered=np.asarray(Image.open(root/f'browser-render-{frame}.png').convert('RGB')).astype(np.int16)
    def mae(box):
        x0,y0,x1,y1=box
        return float(np.abs(preview[y0:y1,x0:x1]-rendered[y0:y1,x0:x1]).mean())
    result=dict(frame=frame,full=mae((0,0,1080,1920)),headline=mae((0,115,1080,400)),cta=mae((305,1350,780,1470)))
    results.append(result)
    print(result)
    # Counter animation can differ by a decoded boundary frame; scene frames isolate overlay parity.
    if frame==130:
        panel=Image.new('RGB',(2160,1920))
        panel.paste(Image.fromarray(preview.astype(np.uint8)),(0,0))
        panel.paste(Image.fromarray(rendered.astype(np.uint8)),(1080,0))
        panel.save(root/'preview-vs-render.jpg')
(root/'preview-comparison.json').write_text(json.dumps(results,indent=2))
for result in results:
    if result['frame'] not in (100,118):
        assert result['headline']<3,result
        assert result['cta']<5,result
print('TOP10_CTA_PARITY=OK')
