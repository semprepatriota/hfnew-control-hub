"""Atomically replace only pink counter 3; never restart the API."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import urllib.request
from datetime import datetime, timezone

from redis import Redis

root = Path('/root/ALLIANCE-DARK/backend')
package = Path(__file__).resolve().parent
patch = json.loads((package / 'patch.json').read_text())
allowed = {'assets/top10/counters/pink3d/03.mp4', 'assets/top10/counters/manifest.json', 'assets/top10/counters/pink-three-provenance.json'}
if set(patch['files']) != allowed:
    raise RuntimeError('Conteudo inesperado no pacote. Nada foi aplicado.')
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
for name, expected in patch['files'].items():
    if digest(package / name) != expected:
        raise RuntimeError('Integridade do pacote invalida: ' + name)
counter = root / 'assets/top10/counters/pink3d/03.mp4'
if digest(counter) not in {patch['previous_counter_sha256'], patch['files']['assets/top10/counters/pink3d/03.mp4']}:
    raise RuntimeError('O contador ativo mudou desde a preparacao. Nada foi aplicado.')
old_catalog = json.loads((root / 'assets/top10/counters/manifest.json').read_text())
new_catalog = json.loads((package / 'assets/top10/counters/manifest.json').read_text())
if old_catalog['models'] != new_catalog['models']:
    raise RuntimeError('Os tempos dos contadores devem permanecer intactos.')
protected = list((root / 'assets/top10/counters').glob('*/*.mp4'))
protected += [root / name for name in ['routes/forge.py', 'routes/forge_5050.py', 'routes/forge_max.py', 'services/top10_service.py'] if (root / name).is_file()]
protected = {str(p): digest(p) for p in protected if p != counter}
redis = Redis.from_url(os.getenv('HFNEW_REDIS_URL', 'redis://127.0.0.1:6379/0'), socket_timeout=3)
lock = redis.lock('hfnew:render:capacity', timeout=90)
print('Aguardando reserva livre para trocar somente o contador 3...', flush=True)
if not lock.acquire(blocking=True, blocking_timeout=120):
    raise RuntimeError('Reserva de render ocupada. Nenhuma alteracao executada.')
backup = Path('/root') / ('top10-counter3-backup-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S'))
originals = {}

def replace(source, target):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as handle:
            temporary = Path(handle.name)
            with source.open('rb') as incoming:
                shutil.copyfileobj(incoming, handle)
            handle.flush()
            os.fsync(handle.fileno())
        shutil.copymode(source, temporary)
        os.replace(temporary, target)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()

try:
    if subprocess.run(['pgrep', '-x', 'ffmpeg'], capture_output=True).returncode == 0:
        raise RuntimeError('Ha processamento de midia ativo. Nada foi aplicado.')
    for name in allowed:
        target = root / name
        originals[name] = target.exists()
        if target.exists():
            saved = backup / name
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, saved)
    for name in sorted(allowed):
        replace(package / name, root / name)
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(counter)]))
    video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    if int(video['nb_frames']) != 29 or (video['width'], video['height'], video['pix_fmt']) != (1080,1920,'yuv420p'):
        raise RuntimeError('O MP4 corrigido nao corresponde ao tempo e formato existentes.')
    if any(digest(Path(path)) != value for path, value in protected.items()):
        raise RuntimeError('Outro arquivo mudou durante a troca.')
    request = urllib.request.Request('http://127.0.0.1:9000/api/top10/counters/pink3d/3.mp4?v=' + new_catalog['revision'], headers={'Range': 'bytes=0-63'})
    with urllib.request.urlopen(request, timeout=10) as response:
        if response.status != 206 or response.read() != counter.read_bytes()[:64]:
            raise RuntimeError('A API nao entregou o arquivo corrigido.')
    print(f'TOP10_COUNTER3=OK\nOTHER_COUNTERS=UNCHANGED\nFORGE_FILES=UNCHANGED\nAPI_RESTART=NOT_NEEDED\nBACKUP={backup}', flush=True)
except Exception:
    for name, existed in originals.items():
        if existed:
            replace(backup / name, root / name)
        else:
            (root / name).unlink(missing_ok=True)
    print('ROLLBACK=concluido', flush=True)
    raise
finally:
    try:
        lock.release()
    except Exception:
        pass
