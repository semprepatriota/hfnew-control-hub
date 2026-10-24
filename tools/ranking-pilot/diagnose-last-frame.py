import json
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image

root = Path('E:/HFNEW-PILOTOS/ranking-multimidia/data')
meta = json.loads((root / 'renders/classic.json').read_text(encoding='utf-8'))
folder = root / 'tail-check'
folder.mkdir(exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(root / 'renders' / meta['filename']),
  '-vf', r'select=gte(n\,348)', '-fps_mode', 'passthrough', '-start_number', '348', str(folder / '%03d.png')], check=True)
preview = np.asarray(Image.open(root / 'preview-classic-359.png').convert('RGB')).astype(float)
for file in sorted(folder.glob('*.png')):
    export = np.asarray(Image.open(file).convert('RGB')).astype(float)
    print(file.stem, float(np.abs(preview[250:1650] - export[250:1650]).mean()))
