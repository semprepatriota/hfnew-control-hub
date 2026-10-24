import json
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image, ImageChops, ImageDraw

ROOT = Path('E:/HFNEW-PILOTOS/ranking-multimidia/data')
rows = []
for model, frames in [('classic', [15, 90, 150, 359]), ('interludes', [15, 72, 99, 404])]:
    result = json.loads((ROOT / 'renders' / (model + '.json')).read_text(encoding='utf-8'))
    video = ROOT / 'renders' / result['filename']
    for frame in frames:
        target = ROOT / f'export-{model}-{frame}.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(video), '-vf', rf'select=eq(n\,{frame})',
                        '-frames:v', '1', str(target)], check=True)
        preview = Image.open(ROOT / f'preview-{model}-{frame}.png').convert('RGB')
        exported = Image.open(target).convert('RGB')
        if preview.size != (1080, 1920) or exported.size != (1080, 1920):
            raise RuntimeError('Comparison must use native composition resolution')
        a, b = np.asarray(preview).astype(float), np.asarray(exported).astype(float)
        difference = np.abs(a-b)
        header = 232 if model == 'classic' else 237
        row = dict(model=model, frame=frame, header_mae=float(difference[:header].mean()),
                   full_mae=float(difference.mean()), media_mae=float(difference[header:1689 if model=='classic' else 1920].mean()))
        rows.append(row)
        side = Image.new('RGB', (720, 660), '#1a1a1a')
        side.paste(preview.resize((360,640)), (0,20))
        side.paste(exported.resize((360,640)), (360,20))
        draw = ImageDraw.Draw(side)
        draw.text((10,4), 'PREVIEW', fill='white')
        draw.text((370,4), 'MP4', fill='white')
        side.save(ROOT / f'comparison-{model}-{frame}.jpg', quality=95)
        print(json.dumps(row), flush=True)
(ROOT / 'frame-comparison.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
if any(row['header_mae'] > 2 or row['full_mae'] > 8 for row in rows):
    raise RuntimeError('Preview/render differences need inspection before approval')
print('FRAME_PARITY=OK')
