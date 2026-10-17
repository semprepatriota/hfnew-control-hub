"""Install only the two recreated counters and record their original audio source."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

backend, generated = Path(sys.argv[1]), Path(sys.argv[2])
repo = Path(__file__).resolve().parent.parent
root = backend / 'assets/top10/counters'
before = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in root.glob('*/*.mp4')}
reference = root / 'pink3d/03.mp4'

def audio_packets(path):
    data = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_packets', '-show_data_hash', 'sha256', '-show_entries', 'packet=data_hash', '-of', 'json', str(path)]))
    return [packet['data_hash'] for packet in data['packets']]

audio = audio_packets(reference)
for rank in [2, 1]:
    source = generated / 'pink3d' / f'{rank:02d}.mp4'
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_streams', '-of', 'json', str(source)]))['streams'][0]
    assert int(probe['nb_frames']) == 30 and probe['width'] == 1080 and probe['height'] == 1920
    assert audio_packets(source) == audio
    shutil.copy2(source, root / 'pink3d' / source.name)
for name, digest in before.items():
    if name not in {'pink3d/01.mp4', 'pink3d/02.mp4'}:
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
catalog = json.loads((root / 'manifest.json').read_text())
catalog['revision'] = hashlib.sha256(b''.join(p.read_bytes() for p in sorted(root.glob('*/*.mp4')))).hexdigest()[:16]
for path in [root / 'manifest.json', repo / 'src/modules/top10/counter-catalog.json']:
    path.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
(root / 'recreated-provenance.json').write_text(json.dumps({
    'ranks': [2, 1], 'renderer': 'tools/top10-counters/premium.html',
    'audio_source': 'pink3d/03.mp4', 'audio_source_sha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
    'audio_packets': 'identical copies of original AAC packets',
    'frames': 30, 'visual_review': 'pending user approval',
}, indent=2) + '\n', encoding='utf-8')
print('RECREATED_COUNTERS=OK\nORIGINAL_AUDIO=IDENTICAL\nOTHER_COUNTERS=UNCHANGED\nREVISION=' + catalog['revision'])
