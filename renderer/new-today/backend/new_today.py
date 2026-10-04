"""Isolated upload and Remotion render queue for NEW TODAY."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field, ValidationError

from utils.user_context import require_current_user
from utils.workspace_storage import workspace_module_root


router = APIRouter(prefix="/api/new-today", tags=["new-today"])
_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="new-today-render")
_LOCK = threading.RLock()
_UPLOADS = set()
_RUNTIME_ID = uuid.uuid4().hex
_MAX_UPLOAD = 300 * 1024**2
_MAX_DURATION = 180.0
_MAX_MEDIA_FRAMES = 5400
_INTRO_FRAMES = 45
_OUTRO_FRAMES = 45
_ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "video/mp4": ".mp4", "video/webm": ".webm"}


class RenderSettings(BaseModel):
    mediaType: Literal["image", "video"]
    headline: str = Field(min_length=4, max_length=180)
    source: str = Field(min_length=2, max_length=240)
    brand: str = Field(default="NEW TODAY", min_length=2, max_length=36)
    cta: str = Field(default="Leia a notícia completa", min_length=2, max_length=100)
    positionX: int = Field(default=50, ge=0, le=100)
    positionY: int = Field(default=50, ge=0, le=100)


def _owner_context(authorization: Optional[str]) -> dict:
    context = require_current_user(authorization)
    if context.get("role") != "owner":
        raise HTTPException(status_code=403, detail="NEW TODAY ainda está restrito ao proprietário")
    return context


def _root(context: dict) -> Path:
    return workspace_module_root("new_today", context=context)


def _job_file(context: dict, job_id: str) -> Path:
    try:
        uuid.UUID(hex=job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Render não encontrado") from exc
    return _root(context) / job_id / "job.json"


def _read_job(context: dict, job_id: str) -> dict:
    path = _job_file(context, job_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Render não encontrado")
    with _LOCK:
        job = json.loads(path.read_text(encoding="utf-8"))
        if job["status"] in {"queued", "running"} and job["runtime_id"] != _RUNTIME_ID:
            job.update(status="failed", error="A API reiniciou durante o render. Envie novamente.")
            _write_job(path, job)
    return job


def _write_job(path: Path, job: dict) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, path)


def _update_job(context: dict, job_id: str, **changes) -> None:
    path = _job_file(context, job_id)
    with _LOCK:
        job = json.loads(path.read_text(encoding="utf-8"))
        job.update(changes)
        _write_job(path, job)


def _video_duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "format=duration:stream=codec_name", "-of", "json", str(path)],
        capture_output=True, text=True, timeout=30, check=False,
    )
    if result.returncode:
        raise HTTPException(status_code=422, detail="Não foi possível ler o vídeo")
    data = json.loads(result.stdout or "{}")
    if not data.get("streams"):
        raise HTTPException(status_code=422, detail="Arquivo sem trilha de vídeo")
    duration = float(data.get("format", {}).get("duration") or 0)
    if not 0 < duration <= _MAX_DURATION:
        raise HTTPException(status_code=422, detail="O vídeo precisa ter até 3 minutos")
    return duration


def _renderer_root() -> Path:
    configured = os.getenv("HFNEW_NEW_TODAY_RENDERER_DIR", "/opt/hfnew-new-today/current").strip()
    if not configured:
        raise RuntimeError("Renderer NEW TODAY não configurado")
    root = Path(configured).resolve()
    cli = root / "node_modules/.bin" / ("remotion.cmd" if os.name == "nt" else "remotion")
    if not (root / "src/modules/new-today/remotion/index.jsx").is_file() or not cli.exists():
        raise RuntimeError("Renderer NEW TODAY não instalado")
    if os.name != "nt" and not shutil.which("systemd-run"):
        raise RuntimeError("Isolamento do render NEW TODAY indisponível")
    return root


def _render(context: dict, job_id: str, source_path: Path, settings: RenderSettings, duration_frames: int) -> None:
    linked = None
    try:
        _update_job(context, job_id, status="running")
        renderer = _renderer_root()
        public_media = renderer / "public" / "new-today-media"
        public_media.mkdir(parents=True, exist_ok=True)
        linked = public_media / f"{job_id}{source_path.suffix}"
        try:
            os.link(source_path, linked)
        except OSError:
            shutil.copyfile(source_path, linked)
        output = source_path.parent / "output.mp4"
        props_path = source_path.parent / "props.json"
        props_path.write_text(json.dumps({
            "mediaSrc": f"/new-today-media/{linked.name}",
            "mediaType": settings.mediaType,
            "headline": settings.headline,
            "source": settings.source,
            "brand": settings.brand,
            "cta": settings.cta,
            "positionX": settings.positionX,
            "positionY": settings.positionY,
            "durationInFrames": duration_frames,
        }, ensure_ascii=False), encoding="utf-8")
        command = [
            str(renderer / "node_modules/.bin" / ("remotion.cmd" if os.name == "nt" else "remotion")), "render",
            "src/modules/new-today/remotion/index.jsx", "NewToday", str(output),
            f"--props={props_path}", "--codec=h264", "--concurrency=1", "--overwrite",
            f"--public-dir={renderer / 'public'}",
        ]
        if os.name != "nt":
            command = ["systemd-run", "--scope", "--quiet", "-p", "MemoryMax=1400M", "-p", "CPUQuota=150%", "--", *command]
        result = subprocess.run(command, cwd=renderer, capture_output=True, text=True, timeout=2400, check=False)
        if result.returncode or not output.is_file() or output.stat().st_size <= 0:
            raise RuntimeError((result.stderr or result.stdout or "Renderização não concluída")[-1200:])
        _update_job(context, job_id, status="completed", filename="output.mp4", size_bytes=output.stat().st_size)
    except Exception as exc:
        _update_job(context, job_id, status="failed", error=f"Renderização falhou: {str(exc)[-700:]}")
    finally:
        if linked is not None:
            linked.unlink(missing_ok=True)
        source_path.unlink(missing_ok=True)


@router.post("/renders", status_code=202)
async def create_render(
    media: UploadFile = File(...), settings: str = Form(...), authorization: Optional[str] = Header(default=None),
):
    context = _owner_context(authorization)
    try:
        values = RenderSettings.model_validate_json(settings)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Confira manchete, fonte e ajustes do vídeo") from exc
    suffix = _ALLOWED.get(media.content_type or "")
    if not suffix or (values.mediaType == "video") != (suffix in {".mp4", ".webm"}):
        raise HTTPException(status_code=415, detail="Envie JPG, PNG, WebP, MP4 ou WebM")
    try:
        _renderer_root()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    root = _root(context)
    if shutil.disk_usage(root).free < 3 * 1024**3:
        raise HTTPException(status_code=507, detail="Espaço insuficiente para renderizar com segurança")
    with _LOCK:
        if _UPLOADS:
            raise HTTPException(status_code=429, detail="Aguarde o envio NEW TODAY em andamento")
        active = 0
        for previous in root.glob("*/job.json"):
            try:
                entry = json.loads(previous.read_text(encoding="utf-8"))
                if entry.get("runtime_id") == _RUNTIME_ID and entry.get("status") in {"queued", "running"}:
                    active += 1
            except (OSError, ValueError):
                continue
        if active:
            raise HTTPException(status_code=429, detail="Aguarde o render NEW TODAY em andamento")
        _UPLOADS.add(_RUNTIME_ID)
    job_id = uuid.uuid4().hex
    folder = root / job_id
    source_path = folder / f"source{suffix}"
    size = 0
    try:
        folder.mkdir(mode=0o700)
        with source_path.open("wb") as target:
            while chunk := await media.read(8 * 1024**2):
                size += len(chunk)
                if size > _MAX_UPLOAD:
                    raise HTTPException(status_code=413, detail="Arquivo acima de 300 MB nesta fase de testes")
                target.write(chunk)
        if not size:
            raise HTTPException(status_code=422, detail="Arquivo vazio")
        if shutil.disk_usage(root).free < max(2 * 1024**3, size):
            raise HTTPException(status_code=507, detail="Espaço insuficiente para o MP4 final")
        if values.mediaType == "image":
            try:
                with Image.open(source_path) as image:
                    image.verify()
            except (UnidentifiedImageError, OSError) as exc:
                raise HTTPException(status_code=422, detail="Imagem inválida") from exc
            duration_frames = 282
        else:
            duration_frames = min(_MAX_MEDIA_FRAMES, round(_video_duration(source_path) * 30)) + _INTRO_FRAMES + _OUTRO_FRAMES
        job = {"id": job_id, "status": "queued", "error": "", "filename": "", "runtime_id": _RUNTIME_ID,
               "duration_frames": duration_frames, "source": values.source, "size_bytes": 0}
        _write_job(folder / "job.json", job)
        _EXECUTOR.submit(_render, dict(context), job_id, source_path, values, duration_frames)
        return job
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    finally:
        with _LOCK:
            _UPLOADS.discard(_RUNTIME_ID)
        await media.close()


@router.get("/renders/{job_id}")
def get_render(job_id: str, authorization: Optional[str] = Header(default=None)):
    return _read_job(_owner_context(authorization), job_id)


@router.get("/renders/{job_id}/file")
def get_render_file(job_id: str, authorization: Optional[str] = Header(default=None)):
    context = _owner_context(authorization)
    job = _read_job(context, job_id)
    if job["status"] != "completed":
        raise HTTPException(status_code=404, detail="MP4 ainda não está pronto")
    path = _job_file(context, job_id).parent / "output.mp4"
    if not path.is_file() or path.stat().st_size <= 0:
        raise HTTPException(status_code=404, detail="MP4 não encontrado")
    return FileResponse(path, media_type="video/mp4", filename=f"new-today-{job_id[:8]}.mp4", headers={"Cache-Control": "private, no-store"})
