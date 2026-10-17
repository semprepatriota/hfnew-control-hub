"""Dedicated TOP 10 API. Existing Forge renderers are not modified."""

from pathlib import Path
import shutil
import uuid

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field

from services import top10_service as studio

router = APIRouter(prefix="/api/top10", tags=["top10"])


class CreateProject(BaseModel):
    title: str = Field(default="Novo TOP 10", max_length=120)


class SaveProject(CreateProject):
    revision: int = Field(ge=1)
    config: studio.Top10Config


class ExportRequest(BaseModel):
    revision: int = Field(ge=1)


class ForgeMaxImport(BaseModel):
    video_id: str = Field(pattern=r'^extractor_[a-f0-9]{16}$')
    clip_ids: list[str] = Field(min_length=1, max_length=10)
    title: str = Field(default='TOP 10 - Forge Max', min_length=1, max_length=120)


@router.post('/imports/forge-max')
def import_forge_max(body: ForgeMaxImport):
    from services.top10_forge_max_bridge import import_clips
    return import_clips(body.video_id, body.clip_ids, body.title)


@router.get("/health")
def health():
    return {"status": "operational", "module": "top10", "scenes": 10, "slots": 20, "models": [
        {"id": key, **model, "ready": all((studio.COUNTERS_ROOT / key / f"{rank:02d}.mp4").is_file() for rank in range(1, 11))}
        for key, model in studio.MODELS.items()
    ]}


@router.get("/projects")
def projects():
    return {"projects": studio.list_projects()}


@router.post("/projects")
def create_project(body: CreateProject):
    return studio.create_project(body.title)


@router.get("/projects/{project_id}")
def project(project_id: str):
    return studio.public_project(studio.read_project(project_id))


@router.put("/projects/{project_id}")
def save_project(project_id: str, body: SaveProject):
    return studio.save_project(project_id, body.title, body.config, body.revision)


@router.delete("/projects/{project_id}")
def delete_project(project_id: str):
    studio.delete_project(project_id)
    return {"deleted": True}


@router.post("/projects/{project_id}/assets")
def upload(project_id: str, kind: str = Query(pattern="^(video|music|logo)$"), slot: int | None = Query(default=None, ge=0, le=9), file: UploadFile = File(...)):
    data = studio.read_project(project_id)
    studio._assert_idle(data)
    allowed = studio.VIDEO_EXT if kind == "video" else studio.AUDIO_EXT if kind == "music" else studio.IMAGE_EXT
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, "Formato de arquivo nao permitido")
    if kind == "video" and slot is None:
        raise HTTPException(400, "Escolha a posicao da cena")
    maximum = 20 * 1024**2 if kind == "logo" else studio.MAX_UPLOAD_BYTES
    path = studio.project_root(project_id) / "files" / f"asset_{uuid.uuid4().hex[:24]}{ext}"
    try:
        total = 0
        with path.open("wb") as output:
            while chunk := file.file.read(1024 * 1024):
                total += len(chunk)
                if total > maximum:
                    raise HTTPException(413, "Arquivo excede o limite de upload")
                if shutil.disk_usage(path.parent).free < 256 * 1024**2:
                    raise HTTPException(507, "Espaco insuficiente para receber este arquivo")
                output.write(chunk)
        if not total:
            raise HTTPException(400, "Arquivo vazio")
        return studio.add_asset(project_id, path, kind, file.filename or path.name, slot)
    except HTTPException:
        path.unlink(missing_ok=True)
        path.with_suffix(".jpg").unlink(missing_ok=True)
        raise
    except Exception as exc:
        path.unlink(missing_ok=True)
        path.with_suffix(".jpg").unlink(missing_ok=True)
        raise HTTPException(400, "Nao foi possivel ler este arquivo de midia") from exc
    finally:
        file.file.close()


@router.delete("/projects/{project_id}/assets/{asset_id}")
def delete_asset(project_id: str, asset_id: str):
    return studio.delete_asset(project_id, asset_id)


@router.post("/projects/{project_id}/exports")
def export_project(project_id: str, body: ExportRequest):
    return studio.start_render(project_id, body.revision)


@router.get("/projects/{project_id}/exports/{job_id}")
def export_status(project_id: str, job_id: str):
    return studio.get_job(project_id, job_id)


@router.post("/projects/{project_id}/exports/{job_id}/cancel")
def cancel_export(project_id: str, job_id: str):
    return studio.cancel_render(project_id, job_id)


@router.api_route("/media/{project_id}/{filename}", methods=["GET", "HEAD"])
def media(project_id: str, filename: str, request: Request, scope: str = "", expires: int = 0, sig: str = "", download: bool = False):
    return studio.stream_media(studio.resolve_media(project_id, filename, scope, expires, sig), request, download)


@router.api_route("/counters/{model}/{rank}.mp4", methods=["GET", "HEAD"])
def counter(model: str, rank: int, request: Request):
    return studio.stream_media(studio.counter_path(model, rank), request)
