"""Add an isolated ranking service. No disk backup is created, as requested."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

BACKEND = Path('/root/ALLIANCE-DARK/backend')
BASE = Path('/opt/hfnew-ranking')
UNIT = Path('/etc/systemd/system/hfnew-ranking.service')
SNIPPET = Path('/etc/nginx/hfnew-ranking-location.conf')
LOCATION = '''location ^~ /api/ranking/ {
    proxy_pass http://127.0.0.1:9007;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
    proxy_request_buffering off;
    client_max_body_size 200m;
}
'''


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def command(args, cwd=None, timeout=180):
    subprocess.run(args, cwd=cwd, check=True, timeout=timeout)


def http(url, expected=200, headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=10) as response:
            status, body = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, body = error.code, error.read()
    if status != expected:
        raise RuntimeError(f'HTTP {status} != {expected}: {url}')
    return body


def nginx_add(text):
    """Insert only inside API server blocks; preserve quoted/commented braces."""
    edits = []
    for match in re.finditer(r'(?m)^\s*server\s*\{', text):
        depth, quote, escaped, comment = 1, None, False, False
        start = match.end()
        for index in range(start, len(text)):
            char = text[index]
            if comment:
                if char == '\n':
                    comment = False
                continue
            if escaped:
                escaped = False
                continue
            if char == '\\':
                escaped = True
                continue
            if quote:
                if char == quote:
                    quote = None
                continue
            if char in ('"', "'"):
                quote = char
            elif char == '#':
                comment = True
            elif char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    block = text[start:index]
                    names = re.search(r'(?m)^\s*server_name\s+([^;]+);', block)
                    if names and 'api.hfnew.com.br' in names.group(1).split():
                        if 'include /etc/nginx/hfnew-ranking-location.conf;' not in block:
                            edits.append(index)
                    break
        else:
            raise RuntimeError('Bloco Nginx sem fechamento')
    for index in reversed(edits):
        text = text[:index] + '\n    include /etc/nginx/hfnew-ranking-location.conf;\n' + text[index:]
    return text, len(edits)


def smoke(runtime):
    with tempfile.TemporaryDirectory(prefix='hfnew-ranking-smoke-') as temporary:
        directory = Path(temporary)
        scene = directory / 'scene.mp4'
        command(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30', '-f', 'lavfi',
                 '-i', 'sine=frequency=440:sample_rate=48000', '-t', '0.5', '-c:v', 'libx264', '-threads', '1',
                 '-pix_fmt', 'yuv420p', '-c:a', 'aac', str(scene)])
        clip = dict(assetId='smoke', startFrame=0, endFrame=15, volume=.5, x=.5, y=.5, zoom=1, fit='cover')
        for model in ('classic', 'interludes'):
            project = dict(model=model, titleLines=['Ranking Teste', 'Corte preciso'], highlights=['Teste', 'preciso'],
                           titleSize=64, labelSize=38, accent='#A27BFF',
                           items=[dict(id='one', label='Cena final', clips=[clip], interlude=None)], music=None, outro=None)
            output = directory / f'{model}.mp4'
            invocation = directory / f'{model}.json'
            invocation.write_text(json.dumps(dict(project=project, assets={'smoke': dict(path=str(scene), frames=15)}, output=str(output))))
            command(['node', str(runtime / 'render.mjs'), str(invocation)], cwd=runtime, timeout=300)
            metadata = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(output)]))
            video = next(s for s in metadata['streams'] if s['codec_type'] == 'video')
            audio = next(s for s in metadata['streams'] if s['codec_type'] == 'audio')
            if video['codec_name'] != 'h264' or video['width'] != 1080 or video['height'] != 1920 or video['pix_fmt'] != 'yuv420p' or audio['codec_name'] != 'aac':
                raise RuntimeError('MP4 de teste incompativel')
            command(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(output), '-f', 'null', '-'])
            print(f'RANKING_{model.upper()}_MP4=OK', flush=True)


def install(package):
    if BACKEND.resolve() != Path('/root/ALLIANCE-DARK/backend') or not (BACKEND / 'venv/bin/python').is_file():
        raise RuntimeError('Backend esperado nao encontrado')
    manifest = json.loads((package / 'manifest.json').read_text())
    for relative, digest in manifest.items():
        file = (package / relative).resolve()
        if not file.is_relative_to(package.resolve()) or sha(file) != digest:
            raise RuntimeError(f'Integridade invalida: {relative}')
    if shutil.disk_usage(BASE.parent).free < 2 * 1024**3:
        raise RuntimeError('Menos de 2 GB livres. Nada foi instalado.')
    protected = {str(path): sha(path) for folder in ('routes', 'services', 'utils') for path in (BACKEND / folder).glob('*.py')
                 if path.name not in ('ranking.py', 'ranking_service.py')}
    protected[str(BACKEND / 'main.py')] = sha(BACKEND / 'main.py')
    old = {}
    changed = []
    current = BASE / 'current'
    previous_target = os.readlink(current) if current.is_symlink() else None
    if current.exists() and not current.is_symlink():
        raise RuntimeError('O caminho de ativacao nao e um link. Nada foi alterado.')
    runtime = BASE / 'releases' / time.strftime('%Y%m%d%H%M%S', time.gmtime())
    runtime.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(package / 'renderer', runtime)
    # Isolated dependencies. No apt upgrade and no changes to the HUB's node_modules.
    command(['npm', 'ci', '--omit=dev', '--no-audit', '--no-fund'], cwd=runtime, timeout=600)
    command(['node', '--input-type=module', '-e', "import {ensureBrowser} from '@remotion/renderer'; await ensureBrowser({chromeMode:'headless-shell'});"], cwd=runtime, timeout=600)
    from redis import Redis
    from rq import Worker
    redis = Redis.from_url(os.getenv('HFNEW_REDIS_URL') or 'redis://127.0.0.1:6379/0', socket_timeout=5)
    redis.ping()
    from rq import Queue
    queue = Queue(os.getenv('HFNEW_FORGE_RENDER_QUEUE') or 'hfnew-forge-renders', connection=redis)
    if queue.count or any(str(getattr(worker.get_state(), 'value', worker.get_state())).lower() == 'busy' for worker in Worker.all(connection=redis)):
        raise RuntimeError('A fila esta em uso. Nada foi ativado; conclua os trabalhos atuais primeiro.')
    lock = redis.lock('hfnew:render:capacity', timeout=900)
    if not lock.acquire(blocking=False):
        raise RuntimeError('Existe render em producao. Nada foi ativado; tente apos concluir.')
    was_active = subprocess.run(['systemctl', 'is-active', '--quiet', 'hfnew-ranking'], check=False).returncode == 0
    try:
        if subprocess.run(['pgrep', '-x', 'ffmpeg'], capture_output=True).returncode == 0:
            raise RuntimeError('FFmpeg esta em uso; ativacao cancelada sem interromper a producao')
        smoke(runtime)
        command([str(BACKEND / 'venv/bin/python'), str(package / 'test_ranking.py')], cwd=package)
        enabled = Path('/etc/nginx/sites-enabled')
        configs = {}
        for link in enabled.iterdir():
            if link.is_file():
                path = link.resolve()
                if path in configs:
                    continue
                text = path.read_text()
                replacement, count = nginx_add(text)
                if count:
                    configs[path] = replacement
        if not configs and not SNIPPET.exists():
            raise RuntimeError('Servidor Nginx da API nao encontrado. Nada foi ativado.')
        unit = f'''[Unit]
Description=HFNEW Ranking isolated API
After=network.target redis-server.service
[Service]
Type=simple
WorkingDirectory={BACKEND}
Environment=PYTHONPATH={current}:{BACKEND}
Environment=NODE_OPTIONS=--max-old-space-size=512
ExecStart={BACKEND}/venv/bin/python -m uvicorn ranking_app:app --host 127.0.0.1 --port 9007
Restart=on-failure
RestartSec=3
MemoryMax=384M
TasksMax=64
UMask=0077
[Install]
WantedBy=multi-user.target
'''
        writes = {UNIT: unit.encode(), SNIPPET: LOCATION.encode()}
        writes.update({path: text.encode() for path, text in configs.items()})
        for relative in ('routes/ranking.py', 'services/ranking_service.py'):
            writes[BACKEND / relative] = (package / 'backend' / relative).read_bytes()
        # In-memory restoration only; the user explicitly declined additional backups.
        for path, content in writes.items():
            old[path] = path.read_bytes() if path.exists() else None
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            changed.append(path)
        for relative in ('routes/ranking.py', 'services/ranking_service.py'):
            compile((BACKEND / relative).read_text(), relative, 'exec')
        temporary_link = BASE / 'activating'
        temporary_link.unlink(missing_ok=True)
        temporary_link.symlink_to(runtime)
        temporary_link.replace(current)
        command(['nginx', '-t'])
        command(['systemctl', 'daemon-reload'])
        command(['systemctl', 'enable', '--now', 'hfnew-ranking'])
        if was_active:
            command(['systemctl', 'restart', 'hfnew-ranking'])
        for _ in range(45):
            try:
                http('http://127.0.0.1:9007/api/ranking/state', 401)
                break
            except (OSError, RuntimeError):
                time.sleep(1)
        else:
            raise RuntimeError('O novo servico nao iniciou; o HUB original continua intacto')
        check = queue.enqueue('services.ranking_service.runtime_check', job_timeout=30, result_ttl=60)
        for _ in range(45):
            check.refresh()
            if check.is_finished:
                if check.result != {'module': 'ranking', 'runtime': True, 'version': 1}:
                    raise RuntimeError('Worker carregou uma versao incorreta')
                break
            if check.is_failed:
                raise RuntimeError('Worker nao conseguiu carregar o novo modulo')
            time.sleep(1)
        else:
            raise RuntimeError('O worker nao respondeu. A troca do frontend foi bloqueada.')
        command(['systemctl', 'reload', 'nginx'])
        http('https://api.hfnew.com.br/api/ranking/state', 401)
        http('https://api.hfnew.com.br/api/ranking/font')
        http('https://api.hfnew.com.br/api/status')
        for name, digest in protected.items():
            if sha(Path(name)) != digest:
                raise RuntimeError(f'Arquivo protegido alterado: {name}')
        print('API_HEALTH=OK\nRANKING_AUTH=OK\nRANKING_WORKER=OK\nFORGE_FILES=UNCHANGED\nHUB_API_RESTARTED=no\nRANKING_BACKEND=OK', flush=True)
    except Exception:
        for path in reversed(changed):
            if old[path] is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(old[path])
        current.unlink(missing_ok=True)
        if previous_target:
            current.symlink_to(previous_target)
        subprocess.run(['systemctl', 'daemon-reload'], check=False)
        subprocess.run(['systemctl', 'restart' if was_active else 'stop', 'hfnew-ranking'], check=False)
        subprocess.run(['nginx', '-t'], check=False)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=False)
        print('ACTIVATION_REVERTED=OK\nHF_HUB_PRESERVED=OK', flush=True)
        raise
    finally:
        lock.release()


if __name__ == '__main__':
    install(Path(__file__).resolve().parent)
