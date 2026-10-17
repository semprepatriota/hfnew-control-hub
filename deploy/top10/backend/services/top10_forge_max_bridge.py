"""Import completed, workspace-owned Forge Max clips without changing their sources."""
import os
from pathlib import Path
import shutil
import subprocess
import uuid

from fastapi import HTTPException

from config import settings
from services.access_policy import AccessPolicyDenied, authorize_api_request
from services.forge_max import extractor_service
from services.render_coordinator import RenderCapacityError, render_slot
from services import top10_service as studio
from utils.user_context import get_current_user_context
from utils.workspace_storage import workspace_module_root


def import_clips(video_id: str, clip_ids: list[str], title: str) -> dict:
    try:
        authorize_api_request(get_current_user_context(), '/api/forge-max/extractor/videos', 'GET')
        authorize_api_request(get_current_user_context(), '/api/top10/projects', 'POST')
    except AccessPolicyDenied as exc:
        raise HTTPException(403, str(exc)) from exc
    if not 1 <= len(clip_ids) <= 10 or len(set(clip_ids)) != len(clip_ids):
        raise HTTPException(400, 'Selecione de um a dez trechos diferentes.')
    try:
        video = extractor_service.get_video(video_id)
        owned_clips = (workspace_module_root('forge_max_extractor') / 'videos' / video_id / 'clips').resolve()
        sources = []
        for clip_id in clip_ids:
            source, clip = extractor_service.clip_file(video_id, clip_id, video['media_key'])
            source = source.resolve()
            if source.parent != owned_clips or not source.is_file():
                raise FileNotFoundError('Trecho nao pertence a este workspace.')
            if not 0 < source.stat().st_size <= studio.MAX_UPLOAD_BYTES:
                raise HTTPException(413, 'Cada cena do TOP 10 aceita ate 512 MB.')
            media = studio.probe_media(source)
            if not media.video_codec or not 0 < media.duration <= studio.MAX_VIDEO_SECONDS:
                raise HTTPException(400, 'Cada cena do TOP 10 precisa ter video e durar no maximo cinco minutos.')
            sources.append((source, clip, media))
    except (FileNotFoundError, ValueError, KeyError) as exc:
        raise HTTPException(404, 'Um dos trechos nao esta pronto ou nao pertence a este workspace.') from exc

    project_id = None
    try:
        with render_slot('top10_import', wait_timeout_seconds=30):
            project = studio.create_project(title)
            project_id = project['id']
            data = studio.read_project(project_id)
            destination = studio.project_root(project_id) / 'files'
            for slot, (source, clip, media) in enumerate(sources):
                asset_id = 'asset_' + uuid.uuid4().hex[:24]
                target = destination / (asset_id + '.mp4')
                if shutil.disk_usage(destination).free < 256 * 1024**2:
                    raise HTTPException(507, 'Espaco abaixo da reserva de seguranca. Nenhum projeto foi importado.')
                try:
                    os.link(source, target)
                except OSError:
                    if shutil.disk_usage(destination).free < source.stat().st_size + 256 * 1024**2:
                        raise HTTPException(507, 'Espaco insuficiente para copiar os trechos.')
                    shutil.copy2(source, target)
                thumbnail = target.with_suffix('.jpg')
                subprocess.run([
                    settings.FFMPEG_BIN, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
                    '-threads', '1', '-i', str(target), '-frames:v', '1', '-vf', 'scale=240:-2',
                    '-threads', '1', str(thumbnail),
                ], check=True, capture_output=True, timeout=30)
                data['assets'][asset_id] = {
                    'id': asset_id, 'kind': 'video', 'filename': target.name,
                    'name': str(clip.get('title') or source.name)[:180], 'size': target.stat().st_size,
                    'duration': media.duration, 'width': media.width, 'height': media.height,
                    'has_audio': bool(media.audio_codec), 'thumbnail': thumbnail.name,
                    'origin': {'module': 'forge_max', 'video_id': video_id, 'clip_id': clip['id']},
                }
                data['config']['scenes'][slot] = studio.SceneConfig(asset_id=asset_id, end=media.duration).model_dump()
            return studio.public_project(studio._write(data))
    except RenderCapacityError as exc:
        raise HTTPException(409, 'Aguarde o processamento em andamento e tente enviar os trechos novamente.') from exc
    except Exception:
        if project_id:
            studio.delete_project(project_id)
        raise
