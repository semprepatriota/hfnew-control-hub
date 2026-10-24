"""Workspace-private ranking storage and durable, capacity-coordinated exports."""
from __future__ import annotations

import copy
import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import threading
import time
import uuid
from urllib.parse import urlencode

from fastapi import HTTPException
from config import settings
from utils.user_context import get_current_user_context, set_current_user, reset_current_user
from utils.workspace_storage import workspace_module_root, workspace_storage_scope, write_json_atomic

FPS = 30
MODELS = ('classic', 'interludes')
RUNTIME = Path(os.environ.get('HFNEW_RANKING_RUNTIME', '/opt/hfnew-ranking/current'))
MAX_UPLOAD = 200 * 1024**2
_LOCK = threading.RLock()


def runtime_check():
    return {'module': 'ranking', 'runtime': (RUNTIME / 'render.mjs').is_file(), 'version': 1}


def root(context=None):
    directory = workspace_module_root('ranking', context=context)
    for part in ('media', 'projects', 'jobs', 'renders'):
        (directory / part).mkdir(parents=True, exist_ok=True)
    return directory


def read(path, fallback=None):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        return copy.deepcopy(fallback)


def preset(model):
    return dict(version=1, id=f'ranking-{model}', model=model, titleLines=['Ranking Melhores', 'Momentos'],
                highlights=['Melhores', 'Momentos'], titleSize=64, labelSize=38, accent='#A27BFF',
                items=[], music=None, outro=None)


def assets():
    return read(root() / 'assets.json', {})


def valid_id(value):
    if not re.fullmatch(r'[a-f0-9]{32}', str(value)):
        raise HTTPException(404, 'Item nao encontrado')
    return value


def checked_file(base, name):
    if not re.fullmatch(r'[a-f0-9]{32}\.(mp4|mov|webm|mkv|mp3|wav|m4a|aac|jpg)', str(name)):
        raise HTTPException(404, 'Arquivo nao encontrado')
    candidate = (base / name).resolve()
    if candidate.parent != base.resolve() or not candidate.is_file():
        raise HTTPException(404, 'Arquivo nao encontrado')
    return candidate


def signature(scope, name, expires):
    return hmac.new(str(settings.SECRET_KEY).encode(), f'ranking\n{scope}\n{name}\n{expires}'.encode(), hashlib.sha256).hexdigest()


def media_url(folder, filename):
    scope = workspace_storage_scope()
    expires = int(time.time()) + 86400
    name = f'{folder}/{filename}'
    return '/api/ranking/media/' + name + '?' + urlencode(dict(scope=scope, expires=expires, sig=signature(scope, name, expires)))


def resolve_media(folder, filename, scope, expires, sig):
    if folder not in ('media', 'renders') or not re.fullmatch(r'[A-Za-z0-9_-]{3,96}', scope) or expires < int(time.time()):
        raise HTTPException(403, 'Link de midia invalido ou expirado')
    if not hmac.compare_digest(signature(scope, f'{folder}/{filename}', expires), sig):
        raise HTTPException(403, 'Assinatura de midia invalida')
    context = dict(workspace_type='internal' if scope == 'legacy_owner' else 'personal', storage_scope=scope)
    return checked_file(root(context) / folder, filename)


def public_asset(asset):
    return {key: asset[key] for key in ('id', 'name', 'frames', 'width', 'height', 'kind')} | {
        'src': media_url('media', asset['filename']),
        'poster': media_url('media', asset['poster']) if asset.get('poster') else None,
    }


def public_render(render):
    return render | {'url': media_url('renders', render['filename'])} if render else None


def number(value, low, high, default):
    try:
        value = float(value)
    except (ValueError, TypeError):
        return default
    return max(low, min(high, value)) if math.isfinite(value) else default


def validate_project(value, catalog):
    if not isinstance(value, dict) or value.get('model') not in MODELS:
        raise HTTPException(400, 'Modelo invalido')
    model = value['model']
    result = preset(model)
    for key in ('titleLines', 'highlights'):
        lines = value.get(key, ['', ''])
        if not isinstance(lines, list) or len(lines) != 2:
            raise HTTPException(400, 'Informe as duas linhas do titulo')
        result[key] = [str(line)[:100 if key == 'titleLines' else 60] for line in lines]
    result['titleSize'] = number(value.get('titleSize'), 32, 90, 64)
    result['labelSize'] = number(value.get('labelSize'), 24, 64, 38)
    if re.fullmatch(r'#[a-fA-F0-9]{6}', str(value.get('accent', ''))):
        result['accent'] = value['accent']

    def clip(data, audio=False):
        if not isinstance(data, dict) or data.get('assetId') not in catalog:
            raise HTTPException(400, 'Midia nao encontrada neste workspace')
        asset = catalog[data['assetId']]
        if not audio and not asset['width']:
            raise HTTPException(400, 'Escolha um video para esta cena')
        start, end = data.get('startFrame'), data.get('endFrame')
        if type(start) is not int or type(end) is not int or not 0 <= start < end <= asset['frames']:
            raise HTTPException(400, 'Corte fora da duracao da midia')
        return dict(assetId=data['assetId'], startFrame=start, endFrame=end,
                    volume=number(data.get('volume'), 0, 1, .8), x=number(data.get('x'), 0, 1, .5),
                    y=number(data.get('y'), 0, 1, .5), zoom=number(data.get('zoom'), 1, 2, 1),
                    fit='contain' if data.get('fit') == 'contain' else 'cover')

    items = value.get('items')
    if not isinstance(items, list) or len(items) > 10:
        raise HTTPException(400, 'Use ate dez posicoes')
    seen = set()
    total = 0
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise HTTPException(400, 'Cena invalida')
        item_id = str(item.get('id', ''))
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', item_id) or item_id in seen:
            raise HTTPException(400, 'Identificacao de cena invalida ou duplicada')
        seen.add(item_id)
        clips = item.get('clips')
        if not isinstance(clips, list) or not 1 <= len(clips) <= 12:
            raise HTTPException(400, 'Use de um a doze trechos por cena')
        clean = dict(id=item_id, label=str(item.get('label', ''))[:80], clips=[clip(c) for c in clips], interlude=None)
        if model == 'interludes' and index < len(items)-1 and item.get('interlude'):
            clean['interlude'] = clip(item['interlude'])
        total += sum(c['endFrame'] - c['startFrame'] for c in clean['clips'])
        if clean['interlude']:
            total += clean['interlude']['endFrame'] - clean['interlude']['startFrame']
        result['items'].append(clean)
    if value.get('music'):
        result['music'] = clip(value['music'], audio=True)
    if value.get('outro') and items:
        result['outro'] = clip(value['outro'])
        total += result['outro']['endFrame'] - result['outro']['startFrame']
    if total > 5400:
        raise HTTPException(400, 'A montagem aceita ate tres minutos')
    return result


def state():
    directory = root()
    catalog = assets()
    active = read(directory / 'active.json')
    if active:
        active = get_job(active['id'])
        if active['status'] not in ('queued', 'rendering'):
            active = None
    return dict(assets={key: public_asset(asset) for key, asset in catalog.items()},
                presets={model: preset(model) for model in MODELS},
                projects={model: read(directory / 'projects' / f'{model}.json', preset(model)) for model in MODELS},
                renders=[public_render(value) for model in MODELS if (value := read(directory / 'renders' / f'{model}.json'))],
                activeJob=active, fontUrl='/api/ranking/font', scope=workspace_storage_scope())


def save_project(value):
    project = validate_project(value, assets())
    write_json_atomic(root() / 'projects' / f'{project["model"]}.json', project)
    return {'saved': True}


def probe(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)],
                            capture_output=True, text=True, timeout=30, check=True)
    return json.loads(result.stdout)


def register_upload(path, name, kind):
    metadata = probe(path)
    video = next((s for s in metadata['streams'] if s['codec_type'] == 'video'), None)
    duration = float((video or {}).get('duration') or metadata['format']['duration'])
    if not math.isfinite(duration) or not 0 < duration <= 180:
        raise HTTPException(400, 'Use midias de ate tres minutos')
    if kind != 'music' and not video:
        raise HTTPException(400, 'Escolha um video')
    if video and max(video['width'], video['height']) > 4096:
        raise HTTPException(400, 'Resolucao maxima por arquivo: 4K')
    asset = dict(id=path.stem, filename=path.name, name=str(name)[:160], frames=math.floor(duration * FPS),
                 width=video['width'] if video else 0, height=video['height'] if video else 0, kind=kind)
    if asset['frames'] < 1:
        raise HTTPException(400, 'Midia curta demais')
    if video:
        poster = path.with_suffix('.jpg')
        subprocess.run(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(path), '-frames:v', '1',
                        '-vf', 'scale=180:-2', '-threads', '1', str(poster)], capture_output=True, timeout=30, check=True)
        asset['poster'] = poster.name
    with _LOCK:
        catalog = assets()
        catalog[asset['id']] = asset
        write_json_atomic(root() / 'assets.json', catalog)
    return public_asset(asset)


def start_render(value):
    from services.forge_render_queue import _queue, _connection, _safe_context
    with _LOCK:
        directory = root()
        active = read(directory / 'active.json')
        if active and get_job(active['id'])['status'] in ('queued', 'rendering'):
            raise HTTPException(409, 'Este workspace ja possui um render na fila')
        catalog = assets()
        project = validate_project(value, catalog)
        if not project['items']:
            raise HTTPException(400, 'Adicione pelo menos uma cena')
        if shutil.disk_usage(directory).free < 1024**3:
            raise HTTPException(507, 'E necessario pelo menos 1 GB livre para renderizar')
        job_id = uuid.uuid4().hex
        job = dict(id=job_id, status='queued', progress=0, model=project['model'])
        context = _safe_context(get_current_user_context())
        # Persist the exact approved edit before enqueueing; workers never read a later draft.
        write_json_atomic(directory / 'jobs' / f'{job_id}.input.json', dict(project=project, assets=catalog))
        write_json_atomic(directory / 'jobs' / f'{job_id}.json', job)
        try:
            queue = _queue(_connection())
            if queue.count >= 20:
                raise HTTPException(429, 'Fila cheia; aguarde uma renderizacao concluir')
            queue.enqueue('services.ranking_service.execute_render', job_id, context, job_id=job_id,
                          job_timeout=3600, result_ttl=86400, failure_ttl=86400,
                          meta=dict(module='ranking', workspace_id=context['workspace_id']))
        except HTTPException:
            raise
        except Exception as exc:
            write_json_atomic(directory / 'jobs' / f'{job_id}.json', job | dict(status='failed', error='Fila indisponivel'))
            raise HTTPException(503, 'Fila indisponivel; nada foi renderizado') from exc
        write_json_atomic(directory / 'active.json', {'id': job_id})
        write_json_atomic(directory / 'projects' / f'{project["model"]}.json', project)
        return job


def get_job(job_id):
    valid_id(job_id)
    job = read(root() / 'jobs' / f'{job_id}.json')
    if not job:
        raise HTTPException(404, 'Render nao encontrado neste workspace')
    if job['status'] in ('queued', 'rendering'):
        from services.forge_render_queue import _connection
        from rq.job import Job
        from rq.exceptions import NoSuchJobError
        try:
            queued = Job.fetch(job_id, connection=_connection())
            status = str(getattr(queued.get_status(), 'value', queued.get_status()))
            if status in ('failed', 'stopped', 'canceled'):
                job = job | dict(status='failed', error='Render interrompido. Tente novamente.')
                write_json_atomic(root() / 'jobs' / f'{job_id}.json', job)
        except NoSuchJobError:
            job = job | dict(status='failed', error='O trabalho expirou na fila. Envie o render novamente.')
            write_json_atomic(root() / 'jobs' / f'{job_id}.json', job)
        except Exception:
            # A transient Redis outage must not discard a running render.
            pass
        if job['status'] == 'rendering':
            try:
                with (root() / 'jobs' / f'{job_id}.log').open('rb') as log:
                    log.seek(0, 2)
                    log.seek(max(0, log.tell() - 16384))
                    progress = re.findall(rb'PROGRESS=(\d+)', log.read())
                    if progress:
                        job = job | dict(progress=min(99, int(progress[-1])))
            except OSError:
                pass
    return public_render(job) if job['status'] == 'ready' else job


def execute_render(job_id, context):
    from services.render_coordinator import render_slot
    token = set_current_user(context)
    directory = root()
    job_path = directory / 'jobs' / f'{valid_id(job_id)}.json'
    job = read(job_path)
    partial = directory / 'renders' / f'{job_id}.partial.mp4'
    final = directory / 'renders' / f'{job_id}.mp4'
    try:
        with render_slot('ranking', wait_timeout_seconds=1800):
            snapshot = read(directory / 'jobs' / f'{job_id}.input.json')
            project = validate_project(snapshot['project'], snapshot['assets'])
            job.update(status='rendering', progress=1)
            write_json_atomic(job_path, job)
            used = {c['assetId'] for item in project['items'] for c in item['clips'] + ([item['interlude']] if item['interlude'] else [])}
            used.update(c['assetId'] for c in (project['music'], project['outro']) if c)
            selected = {}
            for asset_id in used:
                asset = snapshot['assets'][asset_id]
                selected[asset_id] = asset | {'path': str(checked_file(directory / 'media', asset['filename']))}
            invocation = directory / 'jobs' / f'{job_id}.worker.json'
            write_json_atomic(invocation, dict(project=project, assets=selected, output=str(partial)))
            environment = {**os.environ, 'NODE_OPTIONS': '--max-old-space-size=512'}
            with (directory / 'jobs' / f'{job_id}.log').open('w', encoding='utf-8') as log:
                subprocess.run(['node', str(RUNTIME / 'render.mjs'), str(invocation)], env=environment,
                               stdout=log, stderr=subprocess.STDOUT, timeout=3300, check=True, cwd=RUNTIME)
            metadata = probe(partial)
            video = next(s for s in metadata['streams'] if s['codec_type'] == 'video')
            audio = next(s for s in metadata['streams'] if s['codec_type'] == 'audio')
            if (video['codec_name'], video['width'], video['height'], video['pix_fmt']) != ('h264', 1080, 1920, 'yuv420p') or audio['codec_name'] != 'aac' or audio['sample_rate'] != '48000':
                raise ValueError('MP4 fora do padrao')
            clips = [c for item in project['items'] for c in item['clips'] + ([item['interlude']] if item['interlude'] else [])]
            if project['outro']:
                clips.append(project['outro'])
            expected_duration = sum(c['endFrame'] - c['startFrame'] for c in clips) / FPS
            if abs(float(metadata['format']['duration']) - expected_duration) > .15:
                raise ValueError('Duracao exportada diferente da montagem')
            subprocess.run(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(partial), '-f', 'null', '-'], capture_output=True, timeout=300, check=True)
            partial.replace(final)
            job.update(status='ready', progress=100, filename=final.name, duration=float(metadata['format']['duration']), project=project)
            write_json_atomic(directory / 'renders' / f'{project["model"]}.json', job)
            write_json_atomic(job_path, job)
        return {'status': 'ready', 'id': job_id}
    except Exception:
        partial.unlink(missing_ok=True)
        job.update(status='failed', error='Falha ao exportar o ranking. O projeto foi preservado.')
        write_json_atomic(job_path, job)
        raise
    finally:
        reset_current_user(token)
