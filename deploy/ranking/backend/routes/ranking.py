"""Authenticated ranking API; media URLs carry per-workspace signatures."""
from pathlib import Path
import shutil
import uuid

from fastapi import APIRouter, Body, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from services import ranking_service as studio

router = APIRouter(prefix='/api/ranking', tags=['ranking'])


@router.get('/health')
def health():
    return {'status': 'operational', 'module': 'ranking', 'models': ['classic', 'interludes']}


@router.get('/state')
def state():
    return studio.state()


@router.post('/project')
def save(body: dict = Body(...)):
    return studio.save_project(body)


@router.post('/render', status_code=202)
def render(body: dict = Body(...)):
    return studio.start_render(body)


@router.get('/jobs/{job_id}')
def job(job_id: str):
    return studio.get_job(job_id)


@router.post('/upload')
async def upload(request: Request, name: str = Query(max_length=160), kind: str = Query(default='scene', pattern='^(scene|music|interlude)$')):
    extension = Path(name).suffix.lower()
    if extension not in ('.mp4', '.mov', '.webm', '.mkv', '.mp3', '.wav', '.m4a', '.aac'):
        raise HTTPException(400, 'Formato de midia nao permitido')
    path = studio.root() / 'media' / f'{uuid.uuid4().hex}{extension}'
    total = 0
    try:
        with path.open('xb') as target:
            async for chunk in request.stream():
                total += len(chunk)
                if total > studio.MAX_UPLOAD:
                    raise HTTPException(413, 'Limite de 200 MB por arquivo')
                if shutil.disk_usage(path.parent).free < 512 * 1024**2:
                    raise HTTPException(507, 'Espaco insuficiente para este arquivo')
                await run_in_threadpool(target.write, chunk)
        if not total:
            raise HTTPException(400, 'Arquivo vazio')
        return await run_in_threadpool(studio.register_upload, path, name, kind)
    except Exception as exc:
        path.unlink(missing_ok=True)
        path.with_suffix('.jpg').unlink(missing_ok=True)
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(400, 'Nao foi possivel ler esta midia') from exc


@router.api_route('/media/{folder}/{filename}', methods=['GET', 'HEAD'])
def media(folder: str, filename: str, request: Request, scope: str = '', expires: int = 0, sig: str = '', download: bool = False):
    from services.top10_service import stream_media
    return stream_media(studio.resolve_media(folder, filename, scope, expires, sig), request, download)


@router.get('/font')
def font():
    return FileResponse(studio.RUNTIME / 'public/fonts/montserrat-latin-800-normal.woff2', media_type='font/woff2', headers={'Cache-Control': 'public, max-age=86400'})
