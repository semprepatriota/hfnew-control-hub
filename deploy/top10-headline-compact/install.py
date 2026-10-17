"""Patch only the TOP 10 headline painter, preserving all other live code/data."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

PATCHES = [
    ("('v1|' + json.dumps(paint, sort_keys=True))", "('v2-compact|' + json.dumps(paint, sort_keys=True))"),
    ("        image.paste((*tuple(bytes.fromhex(headline.background[1:])), alpha), (0, 0, width, height))",
     "        # Tighten only the painted band; keep the glyphs and their center unchanged.\n"
     "        band_height = min(height, max(bounds[3] - bounds[1] + 24, round(studio.HEIGHT * .095)))\n"
     "        band_top = (height - band_height) // 2\n"
     "        image.paste((*tuple(bytes.fromhex(headline.background[1:])), alpha), (0, band_top, width, band_top + band_height))"),
    ("'height': height, 'applied_font_size': size}", "'height': height, 'applied_font_size': size, 'layout_version': 2}"),
]


def compact_source(source):
    if 'v2-compact|' in source:
        if not all(new in source for _, new in PATCHES):
            raise RuntimeError('Versao compacta incompleta; nenhuma alteracao aplicada')
        return source
    for old, new in PATCHES:
        if source.count(old) != 1:
            raise RuntimeError('O pintor ativo diverge da versao conferida; nenhuma alteracao aplicada')
        source = source.replace(old, new, 1)
    compile(source, 'services/top10_headline_service.py', 'exec')
    return source


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def http(path):
    try:
        with urllib.request.urlopen('http://127.0.0.1:9000' + path, timeout=3) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code


def healthy():
    for _ in range(45):
        try:
            if http('/api/status') == 200:
                return
        except OSError:
            pass
        time.sleep(1)
    raise RuntimeError('A API nao respondeu dentro da janela de inicializacao')


def assert_idle():
    if subprocess.run(['pgrep', '-x', 'ffmpeg'], capture_output=True).returncode == 0:
        raise RuntimeError('Ha video em processamento. Nada sera reiniciado; tente apos concluir.')
    if subprocess.run(['pgrep', '-f', 'services/forge_max/scene_detector.py'], capture_output=True).returncode == 0:
        raise RuntimeError('Ha analise de cenas em andamento. Tente apos concluir.')


def install():
    root = Path('/root/ALLIANCE-DARK/backend')
    if not (root / 'venv/bin/python').is_file():
        raise RuntimeError('Backend/venv nao encontrado')
    os.chdir(root)
    sys.path.insert(0, str(root))
    target = root / 'services/top10_headline_service.py'
    original = target.read_text(encoding='utf-8')
    updated = compact_source(original)
    protected_names = ['main.py', 'routes/forge.py', 'routes/forge2.py', 'routes/forge_5050.py', 'routes/forge_max.py',
                       'routes/top10.py', 'services/top10_service.py', 'services/render_coordinator.py', 'services/forge_render_queue.py']
    protected = {name: digest(root/name) for name in protected_names if (root/name).is_file()}
    from redis import Redis
    connection = Redis.from_url(os.getenv('HFNEW_REDIS_URL', 'redis://127.0.0.1:6379/0'), socket_timeout=3)
    lock = connection.lock('hfnew:render:capacity', timeout=180)
    if not lock.acquire(blocking=False):
        raise RuntimeError('Ha render em producao. Nenhuma alteracao foi aplicada.')
    backup = Path('/root') / ('top10-compact-headline-backup-' + datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S'))
    changed = restarted = False
    try:
        assert_idle()
        backup.mkdir()
        shutil.copy2(target, backup / target.name)
        print(f'BACKUP={backup}', flush=True)
        target.write_text(updated, encoding='utf-8')
        changed = True
        subprocess.run([str(root/'venv/bin/python'), str(Path(__file__).with_name('test_top10_compact_headline.py')), '-v'],
                       env={**os.environ, 'PYTHONPATH': str(root)}, check=True, timeout=45)
        if any(digest(root/name) != value for name, value in protected.items()):
            raise RuntimeError('A protecao detectou alteracao fora da headline TOP 10')
        assert_idle()
        subprocess.run(['systemctl', 'restart', 'hfnew-api'], check=True)
        restarted = True
        healthy()
        if http('/api/top10/projects') != 401:
            raise RuntimeError('Falha na protecao de autenticacao')
        print('API_HEALTH=OK\nAUTH_PROTECTION=OK\nOTHER_FORGE_FILES=UNCHANGED\nTOP10_HEADLINE_COMPACT=OK', flush=True)
    except Exception:
        if changed:
            shutil.copy2(backup/target.name, target)
            if restarted:
                subprocess.run(['systemctl', 'restart', 'hfnew-api'], check=True)
                healthy()
            print('ROLLBACK=concluido', flush=True)
        raise
    finally:
        lock.release()


if __name__ == '__main__':
    install()
