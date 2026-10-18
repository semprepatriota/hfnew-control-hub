"""Install only verified TOP 10 sources, without modifying any stored project."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request


def code_hash(path):
    return hashlib.sha256(path.read_text(encoding='utf-8').encode()).hexdigest()


def http(path):
    try:
        with urllib.request.urlopen('http://127.0.0.1:9000' + path, timeout=3) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code


def healthy():
    for _ in range(60):
        try:
            if http('/api/status') == 200:
                return
        except OSError:
            pass
        time.sleep(1)
    raise RuntimeError('API nao iniciou dentro de 60 segundos')


def assert_idle():
    if subprocess.run(['pgrep', '-x', 'ffmpeg'], capture_output=True).returncode == 0:
        raise RuntimeError('Ha video em processamento. Nenhum reinicio sera feito.')
    if subprocess.run(['pgrep', '-f', 'services/forge_max/scene_detector.py'], capture_output=True).returncode == 0:
        raise RuntimeError('Ha analise de cenas em andamento. Tente depois.')


def install():
    root = Path('/root/ALLIANCE-DARK/backend')
    package = Path(__file__).resolve().parent
    manifest = json.loads((package / 'manifest.json').read_text())
    for name, info in manifest.items():
        target, source = root / name, package / 'backend' / name
        if code_hash(source) != info['after']:
            raise RuntimeError('Arquivo do pacote alterado: ' + name)
        if target.exists() and code_hash(target) not in {info['before'], info['after']}:
            raise RuntimeError('O codigo ativo diverge da versao conferida: ' + name)
        if not target.exists() and info['before'] is not None:
            raise RuntimeError('Arquivo ativo ausente: ' + name)
        compile(source.read_text(encoding='utf-8'), name, 'exec')
    protected = {p.relative_to(root): hashlib.sha256(p.read_bytes()).hexdigest()
                 for p in [root/'main.py', root/'routes/top10.py', root/'services/top10_headline_service.py',
                           root/'services/render_coordinator.py', *root.glob('routes/forge*.py')]
                 if p.is_file()}
    os.chdir(root)
    sys.path.insert(0, str(root))
    from redis import Redis
    connection = Redis.from_url(os.getenv('HFNEW_REDIS_URL', 'redis://127.0.0.1:6379/0'), socket_timeout=3)
    lock = connection.lock('hfnew:render:capacity', timeout=240)
    if not lock.acquire(blocking=False):
        raise RuntimeError('Ha render em producao. Nada foi aplicado.')
    backup = Path('/root/top10-logo-round-backup-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S'))
    changed, restarted = [], False
    try:
        assert_idle()
        backup.mkdir()
        print(f'BACKUP={backup}', flush=True)
        for name in manifest:
            target = root / name
            saved = backup / name
            existed = target.is_file()
            if existed:
                saved.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, saved)
            changed.append((target, saved, existed))
            shutil.copy2(package / 'backend' / name, target)
        subprocess.run([str(root/'venv/bin/python'), str(package/'test_logo.py'), '-v'],
                       env={**os.environ, 'PYTHONPATH': str(root), 'TOP10_LOGO_SMOKE': '0'}, check=True, timeout=45)
        if any(hashlib.sha256((root/name).read_bytes()).hexdigest() != value for name, value in protected.items()):
            raise RuntimeError('Alteracao fora do TOP 10 detectada')
        assert_idle()
        restarted = True
        subprocess.run(['systemctl', 'restart', 'hfnew-api'], check=True)
        healthy()
        if http('/api/top10/projects') != 401:
            raise RuntimeError('Protecao de autenticacao invalida')
        subprocess.run(['systemctl', 'is-active', '--quiet', 'hfnew-api'], check=True)
        print('SERVICE=active\nAPI_HEALTH=OK\nOTHER_FORGE_FILES=UNCHANGED\nTOP10_LOGO_ROUND=OK', flush=True)
    except Exception:
        for target, saved, existed in reversed(changed):
            if existed:
                shutil.copy2(saved, target)
            else:
                target.unlink(missing_ok=True)
        if restarted:
            subprocess.run(['systemctl', 'restart', 'hfnew-api'], check=True)
            healthy()
        print('ROLLBACK=concluido', flush=True)
        raise
    finally:
        lock.release()


if __name__ == '__main__':
    install()
