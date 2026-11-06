"""Install only TOP 10's TOP 3 backend files after a guarded local release."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.request import urlopen

from redis import Redis

ROOT = Path('/root/ALLIANCE-DARK/backend')
PACKAGE = Path(__file__).resolve().parent
FILES = ('services/top10_service.py', 'services/top10_cta_service.py', 'routes/top10.py')
PROTECTED = ('routes/forge.py', 'routes/forge2.py', 'routes/forge_5050.py',
             'routes/forge_max.py', 'services/render_coordinator.py')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def health():
    for _ in range(40):
        try:
            with urlopen('http://127.0.0.1:9000/api/status', timeout=3) as response:
                if response.status == 200:
                    return json.load(response)
        except (OSError, ValueError):
            pass
        time.sleep(1)
    raise RuntimeError('API nao respondeu apos o reinicio')


def main():
    if not ROOT.is_dir():
        raise RuntimeError('Backend ativo inesperado')
    manifest = json.loads((PACKAGE / 'manifest.json').read_text(encoding='utf-8'))
    if set(manifest) != set(FILES):
        raise RuntimeError('Manifesto incompleto')
    for relative in FILES:
        current = ROOT / relative
        incoming = PACKAGE / 'backend' / relative
        if digest(incoming) != manifest[relative]['new']:
            raise RuntimeError(f'Pacote alterado: {relative}')
        if digest(current) != manifest[relative]['old']:
            raise RuntimeError(f'Backend ativo divergiu: {relative}. Nada foi aplicado.')
    if shutil.disk_usage(ROOT).free < 256 * 1024**2:
        raise RuntimeError('Espaco livre insuficiente. Nada foi aplicado.')

    redis = Redis.from_url(os.getenv('HFNEW_REDIS_URL', 'redis://127.0.0.1:6379/0'), socket_timeout=3)
    redis.ping()
    capacity = redis.lock('hfnew:render:capacity', timeout=600)
    if not capacity.acquire(blocking=True, blocking_timeout=30):
        raise RuntimeError('Render em producao. Aguarde terminar antes de instalar.')
    backup = Path('/root') / ('hfnew-top3-backup-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S'))
    changed = False
    restarted = False
    protected = {name: digest(ROOT / name) for name in PROTECTED if (ROOT / name).is_file()}
    try:
        if subprocess.run(['pgrep', '-x', 'ffmpeg'], capture_output=True).returncode == 0:
            raise RuntimeError('FFmpeg ativo. Nada foi aplicado.')
        for relative in FILES:
            target = backup / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)
        for relative in FILES:
            shutil.copy2(PACKAGE / 'backend' / relative, ROOT / relative)
        changed = True
        subprocess.run([str(ROOT / 'venv/bin/python'), '-m', 'py_compile', *(str(ROOT / file) for file in FILES)],
                       check=True, timeout=30)
        for name, original in protected.items():
            if digest(ROOT / name) != original:
                raise RuntimeError(f'Arquivo protegido foi alterado: {name}')
        if subprocess.run(['pgrep', '-x', 'ffmpeg'], capture_output=True).returncode == 0:
            raise RuntimeError('Render iniciou antes do reinicio. Revertendo.')
        subprocess.run(['systemctl', 'restart', 'hfnew-api'], check=True, timeout=30)
        restarted = True
        status = health()
        if not status.get('modules', {}).get('top10'):
            raise RuntimeError('TOP 10 ausente da API')
        try:
            urlopen('http://127.0.0.1:9000/api/top10/projects', timeout=5)
        except HTTPError as error:
            if error.code != 401:
                raise RuntimeError(f'Autenticacao do TOP 10 falhou: {error.code}') from error
        else:
            raise RuntimeError('Rota privada do TOP 10 ficou publica')
        print('SERVICE=active\nAUTH_PROTECTION=OK\nFORGE_FILES=UNCHANGED\nTOP3_BACKEND=OK', flush=True)
        print(f'BACKUP={backup}', flush=True)
    except Exception:
        if changed:
            for relative in FILES:
                shutil.copy2(backup / relative, ROOT / relative)
            if restarted or subprocess.run(['systemctl', 'is-active', '--quiet', 'hfnew-api']).returncode:
                subprocess.run(['systemctl', 'restart', 'hfnew-api'], check=False, timeout=30)
                health()
            print(f'ROLLBACK=concluido\nBACKUP={backup}', flush=True)
        raise
    finally:
        try:
            capacity.release()
        except Exception:
            pass


if __name__ == '__main__':
    main()
