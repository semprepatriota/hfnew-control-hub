"""Apply only the audited Max extractor and its regression test, with idle gates and rollback."""
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
from datetime import datetime, timezone

ROOT=Path('/root/ALLIANCE-DARK/backend')
PROTECTED=['main.py','config.py','routes/forge.py','routes/forge2.py','routes/forge_5050.py',
    'routes/forge_max.py','routes/resumable_uploads.py','routes/top10.py','services/top10_service.py',
    'services/forge_max/archive_service.py',
    'services/render_coordinator.py','services/forge_render_queue.py']

def sha(path):
    digest=hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda:source.read(1024*1024),b''): digest.update(chunk)
    return digest.hexdigest()
def api(path):
    try:
        with urllib.request.urlopen('http://127.0.0.1:9000'+path,timeout=5) as response: return response.status,response.read()
    except urllib.error.HTTPError as error: return error.code,error.read()
def healthy():
    for _ in range(45):
        try:
            code,body=api('/api/status')
            if code==200 and json.loads(body).get('status')=='operational': return
        except (OSError,ValueError): pass
        time.sleep(1)
    raise RuntimeError('API nao voltou ao estado saudavel')
def idle():
    if subprocess.run(['pgrep','-x','ffmpeg'],capture_output=True).returncode==0:
        raise RuntimeError('Existe FFmpeg em uso. Aguarde a producao terminar; nada sera interrompido.')
    if subprocess.run(['pgrep','-f','[s]ervices/forge_max/scene_detector.py'],capture_output=True).returncode==0:
        raise RuntimeError('Existe analise de cenas em andamento. Aguarde terminar.')
    code,body=api('/api/status')
    system=json.loads(body).get('render_system',{}) if code==200 else {}
    if code!=200 or system.get('active_count',0) or system.get('waiting_count',0):
        raise RuntimeError('API ocupada ou com render em fila. Instalacao adiada.')
    storage=ROOT.parent/'storage'
    folders=[storage/'forge_max_extractor/videos',*storage.glob('users/*/forge_max_extractor/videos')]
    for folder in folders:
        for path in folder.glob('extractor_*/video.json'):
            data=json.loads(path.read_text())
            if data.get('status')=='preparing' or data.get('analysis_status')=='running' or data.get('thumbnail_status')=='running' or any(clip.get('status')=='extracting' for clip in data.get('clips',[])):
                raise RuntimeError('Existe tarefa ativa ou em fila no Forge Max. Aguarde terminar.')

def main():
    stage=Path(__file__).resolve().parent
    manifest=json.loads((stage/'manifest.json').read_text())
    for name,digest in manifest['files'].items():
        path=(stage/'backend'/name).resolve()
        if not path.is_relative_to((stage/'backend').resolve()) or sha(path)!=digest:
            raise RuntimeError('Pacote invalido: '+name)
    target=ROOT/'services/forge_max/extractor_service.py'
    if sha(target) not in {manifest['baseline_sha256'],manifest['files']['services/forge_max/extractor_service.py']}:
        raise RuntimeError('O extrator ativo mudou desde a auditoria. Nenhum arquivo sera substituido.')
    if sha(ROOT/'services/forge_max/scene_detector.py') not in {manifest['detector_sha256'],manifest['files']['services/forge_max/scene_detector.py']}:
        raise RuntimeError('O detector mudou desde a auditoria. Nenhum arquivo sera substituido.')
    if shutil.disk_usage(ROOT).free<256*1024**2: raise RuntimeError('Espaco livre abaixo da reserva segura.')
    memory=dict(line.split(':',1) for line in Path('/proc/meminfo').read_text().splitlines())
    if int(memory['MemAvailable'].split()[0])<512*1024: raise RuntimeError('Memoria disponivel abaixo da reserva segura.')
    source=Path(manifest['real_test']['remote_source'])
    storage=Path('/root/ALLIANCE-DARK/storage/forge_max_extractor/videos')
    if not source.resolve().is_relative_to(storage.resolve()) or not source.is_file():
        raise RuntimeError('Original auditado indisponivel. Revisar a validacao antes de publicar.')
    if sha(source)!=manifest['real_test']['source_sha256']:
        raise RuntimeError('O original da VPS difere do video validado. Revisar antes de publicar.')
    print('REAL_SOURCE_SHA256=OK',flush=True)
    protected={name:sha(ROOT/name) for name in PROTECTED if (ROOT/name).is_file()}
    from redis import Redis
    redis=Redis.from_url(os.getenv('HFNEW_REDIS_URL','redis://127.0.0.1:6379/0'),socket_timeout=3)
    capacity=redis.lock('hfnew:render:capacity',timeout=600)
    if not capacity.acquire(blocking=True,blocking_timeout=10): raise RuntimeError('Existe render em uso. Nenhuma alteracao aplicada.')
    backup=Path('/root')/('forge-max-precision-backup-'+datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S'))
    originals={}
    restarted=False
    try:
        idle()
        for name in manifest['files']:
            path=ROOT/name
            originals[name]=path.is_file()
            if path.is_file():
                saved=backup/name;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,saved)
        backup.mkdir(parents=True,exist_ok=True)
        print('BACKUP='+str(backup),flush=True)
        for name in manifest['files']:
            path=ROOT/name;path.parent.mkdir(parents=True,exist_ok=True)
            temporary=path.with_suffix(path.suffix+'.precision-tmp')
            shutil.copy2(stage/'backend'/name,temporary);os.replace(temporary,path)
            compile(path.read_text(encoding='utf-8-sig'),str(path),'exec')
        environment={**os.environ,'PYTHONPATH':str(ROOT)}
        subprocess.run([str(ROOT/'venv/bin/python'),'-m','unittest','tests.test_forge_max_extractor',
            'tests.test_forge_max_scene_motion_guard','tests.test_forge_max_archive_stream','tests.test_forge_max_cut_precision'],
            cwd=ROOT,env=environment,check=True,timeout=300)
        if any(sha(ROOT/name)!=digest for name,digest in manifest['files'].items()): raise RuntimeError('Os arquivos publicados mudaram durante a validacao.')
        print('DETECTOR_FILES=CONFIRMED',flush=True)
        if any(sha(ROOT/name)!=digest for name,digest in protected.items()): raise RuntimeError('Arquivo protegido alterado.')
        idle()
        subprocess.run(['systemctl','restart','hfnew-api'],check=True);restarted=True
        healthy()
        for path in ['/api/forge-max/extractor/health','/api/forge/','/api/forge5050/health','/api/top10/projects']:
            if api(path)[0]!=401: raise RuntimeError('Falha na protecao de autenticacao: '+path)
        if any(sha(ROOT/name)!=digest for name,digest in protected.items()): raise RuntimeError('Arquivo protegido alterado.')
        if subprocess.check_output(['systemctl','is-active','hfnew-api'],text=True).strip()!='active': raise RuntimeError('API inativa.')
        print('API_HTTP=200\nAUTH_PROTECTION=OK\nOTHER_FORGE_FILES=UNCHANGED\nSCENE_DETECTOR_PROFILE=PRESERVED\nSERVICE=active\nCUT_PRECISION=frame_exact_v1\nBOUNDARY_REFINEMENT=OK\nFORGE_MAX_PRECISION=OK\nFORGE_MAX_DEPLOY=OK',flush=True)
    except Exception:
        for name,existed in originals.items():
            if existed: shutil.copy2(backup/name,ROOT/name)
            else: (ROOT/name).unlink(missing_ok=True)
        if restarted:
            subprocess.run(['systemctl','restart','hfnew-api'],check=False);healthy()
        print('ROLLBACK=concluido\nBACKUP='+str(backup),flush=True)
        raise
    finally:
        capacity.release()

if __name__=='__main__': main()
