"""Controlled TOP 10-only update, preserving projects and the Jesus Te Ama app."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request

NAMES = {'services/top10_service.py'}


def digest(path):
    data = path.read_text(encoding='utf-8').encode() if path.suffix == '.py' else path.read_bytes()
    return hashlib.sha256(data).hexdigest()


def http(path, expected):
    try:
        with urllib.request.urlopen('http://127.0.0.1:9000'+path,timeout=3) as response:
            code,body=response.status,response.read()
    except urllib.error.HTTPError as exc:
        code,body=exc.code,exc.read()
    if code != expected:
        raise RuntimeError(f'HTTP inesperado {code}: {path}')
    return json.loads(body)


def healthy():
    for _ in range(60):
        try:
            return http('/api/status',200)
        except (OSError,RuntimeError,ValueError):
            time.sleep(1)
    raise RuntimeError('API nao voltou em 60 segundos')


def idle():
    if subprocess.run(['pgrep','-x','ffmpeg'],capture_output=True).returncode == 0:
        raise RuntimeError('Existe video em processamento. Nenhum reinicio foi feito.')
    status=http('/api/status',200).get('render_system',{})
    if status.get('active_count',0) or status.get('waiting_count',0):
        raise RuntimeError('A fila esta em uso. Aguarde concluir antes de aplicar.')


def install():
    root=Path('/root/ALLIANCE-DARK/backend')
    package=Path(__file__).resolve().parent
    manifest=json.loads((package/'manifest.json').read_text())
    if set(manifest) != NAMES:
        raise RuntimeError('Escopo do pacote nao corresponde ao TOP 10 aprovado')
    for name,entry in manifest.items():
        target,source=root/name,package/'backend'/name
        if digest(source) != entry['after']:
            raise RuntimeError('Integridade do pacote invalida: '+name)
        before=digest(target) if target.is_file() else None
        if before not in (entry['before'],entry['after']):
            raise RuntimeError('O codigo ativo mudou depois da auditoria: '+name)
        if source.suffix == '.py':
            compile(source.read_text(),name,'exec')
    protected={path:hashlib.sha256(path.read_bytes()).hexdigest() for path in root.rglob('*.py')
               if path.relative_to(root).as_posix() not in NAMES and 'venv' not in path.parts}
    os.chdir(root)
    sys.path.insert(0,str(root))
    from redis import Redis
    from rq import Queue,Worker
    redis=Redis.from_url(os.getenv('HFNEW_REDIS_URL') or 'redis://127.0.0.1:6379/0',socket_timeout=5)
    redis.ping()
    lock=redis.lock('hfnew:render:capacity',timeout=600)
    if not lock.acquire(blocking=False):
        raise RuntimeError('Render em andamento. Nada foi aplicado.')
    old={}
    restarted=False
    try:
        idle()
        queue=Queue(os.getenv('HFNEW_FORGE_RENDER_QUEUE') or 'hfnew-forge-renders',connection=redis)
        if queue.count or any(str(getattr(w.get_state(),'value',w.get_state())).lower()=='busy' for w in Worker.all(connection=redis)):
            raise RuntimeError('Worker em uso. Nada foi aplicado.')
        for name in NAMES:
            target=root/name
            old[target]=target.read_bytes() if target.exists() else None
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes((package/'backend'/name).read_bytes())
        subprocess.run([str(root/'venv/bin/python'),str(package/'test_no_counters.py')],cwd=root,
                       env={**os.environ,'PYTHONPATH':str(root),'TOP10_FORMAT_SMOKE':'1','TOP10_FORMAT_OUTPUT':''},check=True,timeout=240)
        if any(hashlib.sha256(path.read_bytes()).hexdigest()!=value for path,value in protected.items()):
            raise RuntimeError('Arquivo fora do TOP 10 alterado')
        idle()
        subprocess.run(['systemctl','restart','hfnew-api'],check=True)
        restarted=True
        healthy()
        http('/api/top10/projects',401)
        subprocess.run(['systemctl','is-active','--quiet','hfnew-api'],check=True)
        print('SERVICE=active\nAPI_HEALTH=OK\nAUTH_PROTECTION=OK\nOTHER_MODULES=UNCHANGED\nTOP10_NO_COUNTERS=OK',flush=True)
    except Exception:
        for target,data in old.items():
            if data is None:
                target.unlink(missing_ok=True)
            else:
                target.write_bytes(data)
        if restarted:
            subprocess.run(['systemctl','restart','hfnew-api'],check=True)
            healthy()
        print('ROLLBACK=concluido',flush=True)
        raise
    finally:
        lock.release()


if __name__=='__main__':
    install()
