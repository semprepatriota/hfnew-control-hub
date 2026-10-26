"""TOP 10 projects and bounded, sequential video exports."""

from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode

from fastapi import HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, Field, model_validator

from config import settings
from services.forge.ffmpeg_service import probe_media
from services.render_coordinator import render_slot
from services.top10_headline_service import HeadlineConfig, prepare_headlines
from services.top10_logo_service import LOGO_VIDEO_EXT, logo_overlay, validate_logo_video
from services.top10_cta_service import cta_overlay
from utils.user_context import get_current_user_context, reset_current_user, set_current_user
from utils.workspace_storage import workspace_module_root, workspace_storage_scope, write_json_atomic

COUNTERS_ROOT = Path(__file__).resolve().parent.parent / "assets" / "top10" / "counters"
MODELS = json.loads((COUNTERS_ROOT / "manifest.json").read_text(encoding="utf-8"))["models"]
FPS = 30
WIDTH, HEIGHT = 1080, 1920
MAX_UPLOAD_BYTES = 512 * 1024 * 1024
MAX_VIDEO_SECONDS = 300
MAX_OUTPUT_SECONDS = 600
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".aac", ".ogg"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
_LOCKS: dict[str, threading.RLock] = {}
_GUARD = threading.RLock()
_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="top10-export")
_ACTIVE: set[str] = set()


class SceneConfig(BaseModel):
    asset_id: str = ""
    start: float = Field(default=0, ge=0, le=MAX_VIDEO_SECONDS)
    end: float = Field(default=0, ge=0, le=MAX_VIDEO_SECONDS)
    x: float = Field(default=0.5, ge=0, le=1)
    y: float = Field(default=0.5, ge=0, le=1)
    zoom: float = Field(default=1, ge=1, le=3)
    volume: float = Field(default=1, ge=0, le=1)
    headline: HeadlineConfig = Field(default_factory=HeadlineConfig)

    @model_validator(mode="after")
    def align_frames(self):
        self.start = int(self.start * FPS + 0.5) / FPS
        self.end = int(self.end * FPS + 0.5) / FPS
        return self


class Top10Config(BaseModel):
    model: str = Field(default="pink3d", pattern=r'^[a-z][a-z0-9_]{0,31}$')
    counters_enabled: bool = True
    scenes: list[SceneConfig] = Field(default_factory=lambda: [SceneConfig() for _ in range(10)], min_length=10, max_length=10)
    counter_volume: float = Field(default=0.6, ge=0, le=1)
    music_volume: float = Field(default=0.15, ge=0, le=1)
    title_enabled: bool = False
    title: str = Field(default="", max_length=180)
    title_size: int = Field(default=68, ge=24, le=120)
    title_color: str = "#ffffff"
    title_y: float = Field(default=0.08, ge=0, le=0.85)
    logo_enabled: bool = False
    logo_x: float = Field(default=0.12, ge=0, le=1)
    logo_y: float = Field(default=0.84, ge=0, le=1)
    logo_size: float = Field(default=0.14, ge=0.04, le=0.4)
    logo_opacity: float = Field(default=1, ge=0, le=1)
    logo_round: bool = True
    logo_layout_version: int = Field(default=4, ge=0, le=4)
    cta_enabled: bool = True

    @model_validator(mode="before")
    @classmethod
    def lock_logo_layout(cls, values):
        if isinstance(values, dict):
            return {**values, 'logo_x': .12, 'logo_y': .84, 'logo_size': .14,
                    'logo_opacity': 1, 'logo_round': True, 'logo_layout_version': 4}
        return values

    @model_validator(mode="after")
    def validate_color(self):
        if self.model not in MODELS:
            raise ValueError("Modelo de contador nao instalado")
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", self.title_color):
            raise ValueError("Cor do titulo invalida")
        return self


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def project_root(project_id: str, context: dict | None = None) -> Path:
    if not re.fullmatch(r"top10_[a-f0-9]{24}", project_id):
        raise HTTPException(400, "Projeto TOP 10 invalido")
    root = workspace_module_root("top10", context=context) / "projects"
    path = (root / project_id).resolve()
    if not path.is_relative_to(root.resolve()):
        raise HTTPException(400, "Caminho invalido")
    return path


def _lock(project_id: str):
    key = str(project_root(project_id))
    with _GUARD:
        return _LOCKS.setdefault(key, threading.RLock())


def read_project(project_id: str) -> dict:
    path = project_root(project_id) / "project.json"
    if not path.is_file():
        raise HTTPException(404, "Projeto TOP 10 nao encontrado")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise HTTPException(500, "Nao foi possivel ler o projeto") from exc


def _write(data: dict):
    data["updated_at"] = _now()
    data["revision"] = int(data.get("revision", 0)) + 1
    write_json_atomic(project_root(data["id"]) / "project.json", data)
    return data


def _assert_idle(data: dict):
    job = data.get("job")
    if job and get_job(data["id"], job)["status"] in {"queued", "running", "cancelling"}:
        raise HTTPException(409, "Aguarde ou cancele a exportacao deste projeto")


def create_project(title: str) -> dict:
    project_id = f"top10_{uuid.uuid4().hex[:24]}"
    path = project_root(project_id)
    for folder in ("files", "renders", "jobs"):
        (path / folder).mkdir(parents=True, exist_ok=True)
    return public_project(_write({
        "id": project_id, "title": title.strip() or "Novo TOP 10", "created_at": _now(),
        "revision": 0, "config": Top10Config().model_dump(), "assets": {}, "music": "", "logo": "",
        "last_render": None, "job": None,
    }))


def list_projects() -> list[dict]:
    root = workspace_module_root("top10") / "projects"
    if not root.is_dir():
        return []
    projects = []
    for path in root.glob("top10_*/project.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            projects.append(public_project(data))
        except (OSError, ValueError):
            continue
    return sorted(projects, key=lambda data: data["updated_at"], reverse=True)


def _signature(resource: str, scope: str, expires: int) -> str:
    return hmac.new(str(settings.SECRET_KEY).encode(), f"{scope}\n{expires}\n{resource}".encode(), hashlib.sha256).hexdigest()


def media_url(project_id: str, filename: str) -> str:
    resource = f"/api/top10/media/{project_id}/{filename}"
    scope = workspace_storage_scope()
    expires = int(time.time()) + 7 * 86400
    return f"{resource}?{urlencode({'scope': scope, 'expires': expires, 'sig': _signature(resource, scope, expires)})}"


def resolve_media(project_id: str, filename: str, scope: str, expires: int, sig: str) -> Path:
    if not re.fullmatch(r"[a-zA-Z0-9_-]{3,96}", scope) or expires < int(time.time()):
        raise HTTPException(403, "Link de midia invalido ou expirado")
    resource = f"/api/top10/media/{project_id}/{filename}"
    if not hmac.compare_digest(_signature(resource, scope, expires), sig):
        raise HTTPException(403, "Assinatura de midia invalida")
    context = {"workspace_type": "internal" if scope == "legacy_owner" else "personal", "storage_scope": scope}
    root = project_root(project_id, context)
    if not re.fullmatch(r"[A-Za-z0-9_-]+\.(mp4|mov|m4v|mkv|webm|mp3|wav|m4a|aac|ogg|png|jpg|jpeg|webp)", filename):
        raise HTTPException(404, "Arquivo nao encontrado")
    for folder in ("files", "renders"):
        path = (root / folder / filename).resolve()
        if path.is_relative_to((root / folder).resolve()) and path.is_file():
            return path
    raise HTTPException(404, "Arquivo nao encontrado")


def public_project(data: dict) -> dict:
    result = {**data, "assets": {}}
    result['config'] = Top10Config(**data['config']).model_dump()
    result['scene_headlines'] = {slot: {**entry, 'url': media_url(data['id'], entry['filename'])}
                                 for slot, entry in data.get('scene_headlines', {}).items()}
    for key, asset in data.get("assets", {}).items():
        result["assets"][key] = {**asset, "url": media_url(data["id"], asset["filename"])}
        if asset.get("thumbnail"):
            result["assets"][key]["thumbnail_url"] = media_url(data["id"], asset["thumbnail"])
    if data.get("title_image"):
        result["title_image_url"] = media_url(data["id"], data["title_image"])
    if data.get("last_render"):
        result["last_render"] = {**data["last_render"], "url": media_url(data["id"], data["last_render"]["filename"])}
    if data.get("job"):
        result["job_state"] = get_job(data["id"], data["job"])
    return result


def _font(size: int):
    candidates = [os.getenv("TOP10_FONT_PATH", ""), "C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return ImageFont.truetype(candidate, size)
    raise HTTPException(503, "Fonte do TOP 10 nao instalada")


def _title_image(data: dict):
    config = Top10Config(**data["config"])
    if not config.title_enabled or not config.title.strip():
        data["title_image"] = ""
        return
    digest = hashlib.sha256(f"{config.title}|{config.title_size}|{config.title_color}".encode()).hexdigest()[:16]
    filename = f"title_{digest}.png"
    path = project_root(data["id"]) / "files" / filename
    if not path.exists():
        font = _font(config.title_size)
        image = Image.new("RGBA", (WIDTH, 520))
        draw = ImageDraw.Draw(image)
        lines, line = [], ""
        for word in config.title.split():
            candidate = f"{line} {word}".strip()
            if draw.textbbox((0, 0), candidate, font=font, stroke_width=3)[2] > 920 and line:
                lines.append(line)
                line = word
            else:
                line = candidate
        if line:
            lines.append(line)
        if len(lines) > 4 or any(draw.textlength(line, font=font) > 920 for line in lines):
            raise HTTPException(400, "Reduza o titulo ou o tamanho da fonte para caber no video")
        y = 10
        for line in lines:
            box = draw.textbbox((0, 0), line, font=font, stroke_width=3)
            draw.text((WIDTH / 2, y - box[1]), line, font=font, anchor="mt", fill=config.title_color, stroke_width=3, stroke_fill="#111111")
            y += config.title_size * 1.25
        image.crop((0, 0, WIDTH, min(520, int(y + 10)))).save(path)
    data["title_image"] = filename


def save_project(project_id: str, title: str, config: Top10Config, revision: int) -> dict:
    with _lock(project_id):
        data = read_project(project_id)
        _assert_idle(data)
        if revision != data["revision"]:
            raise HTTPException(409, "Projeto mudou em outra janela. Reabra o projeto para continuar.")
        for scene in config.scenes:
            if scene.asset_id:
                asset = data["assets"].get(scene.asset_id)
                if not asset or asset["kind"] != "video":
                    raise HTTPException(400, "Cena nao pertence a este projeto")
                end = scene.end or asset["duration"]
                if scene.start >= end or end > asset["duration"] + 0.05:
                    raise HTTPException(400, "O inicio deve vir antes do fim e respeitar a duracao da cena")
        data.update(title=title.strip() or "TOP 10", config=config.model_dump())
        _title_image(data)
        prepare_headlines(data)
        return public_project(_write(data))


def delete_project(project_id: str):
    with _lock(project_id):
        data = read_project(project_id)
        _assert_idle(data)
        shutil.rmtree(project_root(project_id))


def add_asset(project_id: str, path: Path, kind: str, original_name: str, slot: int | None) -> dict:
    with _lock(project_id):
        data = read_project(project_id)
        _assert_idle(data)
        asset_id = path.stem
        asset = {"id": asset_id, "kind": kind, "filename": path.name, "name": Path(original_name).name[:180], "size": path.stat().st_size}
        if kind in {"video", "music"} or (kind == "logo" and path.suffix.lower() in LOGO_VIDEO_EXT):
            media = probe_media(path)
            if kind == "logo":
                validate_logo_video(media)
            if media.duration <= 0 or media.duration > (MAX_VIDEO_SECONDS if kind == "video" else 3600):
                raise HTTPException(400, "Duracao invalida. Cada cena aceita ate 5 minutos.")
            if kind == "video" and (not media.width or not media.height):
                raise HTTPException(400, "O arquivo nao contem video")
            if kind == "music" and not media.audio_codec:
                raise HTTPException(400, "O arquivo nao contem audio")
            asset.update(duration=media.duration, width=media.width, height=media.height, has_audio=bool(media.audio_codec))
            if kind == "video":
                thumbnail = path.with_suffix(".jpg")
                subprocess.run([settings.FFMPEG_BIN, "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(path), "-frames:v", "1", "-vf", "scale=240:-2", "-y", str(thumbnail)], check=True, capture_output=True, timeout=60)
                asset["thumbnail"] = thumbnail.name
                if slot is None or not 0 <= slot < 10:
                    raise HTTPException(400, "Posicao da cena invalida")
                data["config"]["scenes"][slot] = SceneConfig(asset_id=asset_id, end=media.duration).model_dump()
            elif kind == "music":
                data["music"] = asset_id
            else:
                asset['animated'] = True
                data['logo'] = asset_id
                data['config']['logo_enabled'] = True
        else:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                if image.width > 8000 or image.height > 8000:
                    raise HTTPException(400, "Logo muito grande")
                asset.update(width=image.width, height=image.height)
            data["logo"] = asset_id
            data["config"]["logo_enabled"] = True
        data["assets"][asset_id] = asset
        return public_project(_write(data))


def delete_asset(project_id: str, asset_id: str) -> dict:
    with _lock(project_id):
        data = read_project(project_id)
        _assert_idle(data)
        asset = data["assets"].pop(asset_id, None)
        if not asset:
            raise HTTPException(404, "Arquivo nao encontrado")
        for i, scene in enumerate(data["config"]["scenes"]):
            if scene["asset_id"] == asset_id:
                data["config"]["scenes"][i] = SceneConfig().model_dump()
        for key in ("music", "logo"):
            if data.get(key) == asset_id:
                data[key] = ""
        _write(data)
        root = project_root(project_id) / "files"
        for key in ("filename", "thumbnail"):
            if asset.get(key):
                (root / asset[key]).unlink(missing_ok=True)
        return public_project(data)


def counter_path(model: str, rank: int) -> Path:
    if model not in MODELS or rank not in range(1, 11):
        raise HTTPException(404, "Contador nao encontrado")
    path = COUNTERS_ROOT / model / f"{rank:02d}.mp4"
    if not path.is_file():
        raise HTTPException(503, "Modelo de contador ainda nao instalado")
    return path


def timeline(data: dict) -> list[dict]:
    config = Top10Config(**data["config"])
    items, frame = [], 0
    for i, scene in enumerate(config.scenes):
        if not scene.asset_id:
            continue
        asset = data["assets"].get(scene.asset_id)
        if not asset:
            raise HTTPException(400, f"Adicione o video da cena {10-i}")
        end = min(scene.end or asset["duration"], asset["duration"])
        scene_frames = int((end - scene.start) * FPS + 0.5)
        if scene_frames < 2:
            raise HTTPException(400, f"O corte da cena {10-i} e curto demais")
        if config.counters_enabled:
            model = MODELS[config.model]
            count_frames = model.get("frames_by_rank", {}).get(str(10-i), model["frames"])
            items.append({"kind": "counter", "rank": 10-i, "frames": count_frames, "from": frame})
            frame += count_frames
        items.append({"kind": "scene", "rank": 10-i, "slot": i, "frames": scene_frames, "from": frame})
        frame += scene_frames
    if not items:
        raise HTTPException(400, "Adicione pelo menos uma cena para exportar")
    if frame / FPS > MAX_OUTPUT_SECONDS:
        raise HTTPException(400, "A montagem completa aceita ate 10 minutos")
    return items


def _job_path(project_id: str, job_id: str) -> Path:
    if not re.fullmatch(r"job_[a-f0-9]{24}", job_id):
        raise HTTPException(400, "Exportacao invalida")
    return project_root(project_id) / "jobs" / f"{job_id}.json"


def get_job(project_id: str, job_id: str) -> dict:
    path = _job_path(project_id, job_id)
    if not path.is_file():
        raise HTTPException(404, "Exportacao nao encontrada")
    with _GUARD:
        job = json.loads(path.read_text(encoding="utf-8"))
        if job["status"] in {"queued", "running", "cancelling"} and str(path) not in _ACTIVE:
            job.update(status="failed", error="Exportacao interrompida pelo reinicio do servico. O projeto foi preservado.")
            write_json_atomic(path, job)
    return job


def start_render(project_id: str, revision: int) -> dict:
    with _lock(project_id):
        data = read_project(project_id)
        _assert_idle(data)
        if revision != data["revision"]:
            raise HTTPException(409, "Salve os ajustes atuais antes de exportar")
        items = timeline(data)
        for item in items:
            if item["kind"] == "counter":
                counter_path(data["config"]["model"], item["rank"])
        seconds = sum(item["frames"] for item in items) / FPS
        if shutil.disk_usage(project_root(project_id)).free < 512 * 1024**2 + int(seconds * 2_500_000):
            raise HTTPException(507, "Espaco insuficiente para exportar com reserva de seguranca")
        job_id = f"job_{uuid.uuid4().hex[:24]}"
        path = _job_path(project_id, job_id)
        with _GUARD:
            if len(_ACTIVE) >= 4:
                raise HTTPException(409, "A fila do TOP 10 esta cheia. Aguarde uma exportacao terminar.")
            _ACTIVE.add(str(path))
        job = {"id": job_id, "status": "queued", "progress": 0, "created_at": _now(), "error": "", "cancel_requested": False}
        write_json_atomic(path, job)
        data["job"] = job_id
        _write(data)
        context = dict(get_current_user_context())
        try:
            _EXECUTOR.submit(_worker, data, job_id, context)
        except Exception:
            with _GUARD:
                _ACTIVE.discard(str(path))
            job.update(status="failed", error="Nao foi possivel iniciar a exportacao")
            write_json_atomic(path, job)
            raise HTTPException(503, job["error"])
        return job


def cancel_render(project_id: str, job_id: str) -> dict:
    with _GUARD:
        job = get_job(project_id, job_id)
        if job["status"] in {"queued", "running", "cancelling"}:
            job.update(cancel_requested=True, status="cancelled" if job["status"] == "queued" else "cancelling")
            write_json_atomic(_job_path(project_id, job_id), job)
        return job


def _update_job(path: Path, **updates):
    with _GUARD:
        job = json.loads(path.read_text(encoding="utf-8"))
        if job.get("cancel_requested") and updates.get("status") not in {"cancelled", "failed"}:
            raise InterruptedError("Exportacao cancelada")
        job.update(updates)
        write_json_atomic(path, job)


def _run(args: list[str], job_path: Path, timeout: float = 1800):
    with tempfile.TemporaryFile() as errors:
        process = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=errors)
        started = time.monotonic()
        try:
            while process.poll() is None:
                job = json.loads(job_path.read_text(encoding="utf-8"))
                if job.get("cancel_requested"):
                    raise InterruptedError("Exportacao cancelada")
                if time.monotonic() - started > timeout:
                    raise RuntimeError("O processamento excedeu o tempo limite")
                time.sleep(0.2)
            if process.returncode:
                errors.seek(0, 2)
                errors.seek(max(0, errors.tell() - 2500))
                detail = errors.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"FFmpeg falhou: {detail[-1600:]}")
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=10)


def _worker(data: dict, job_id: str, context: dict):
    token = set_current_user(context)
    job_path = _job_path(data["id"], job_id)
    try:
        if not job_path.exists() or json.loads(job_path.read_text(encoding="utf-8")).get("cancel_requested"):
            return
        with render_slot("top10", wait_timeout_seconds=1800):
            _update_job(job_path, status="running", started_at=_now())
            result = render_project(data, job_path)
            with _lock(data["id"]):
                current = read_project(data["id"])
                current["last_render"] = result
                _write(current)
            _update_job(job_path, progress=100, status="completed", finished_at=_now(), filename=result["filename"])
    except InterruptedError:
        if job_path.exists():
            _update_job(job_path, status="cancelled", finished_at=_now())
    except Exception as exc:
        if job_path.exists():
            _update_job(job_path, status="failed", error=str(exc)[-1800:], finished_at=_now())
    finally:
        with _GUARD:
            _ACTIVE.discard(str(job_path))
        reset_current_user(token)


def render_project(data: dict, job_path: Path) -> dict:
    config = Top10Config(**data["config"])
    prepare_headlines(data)
    root = project_root(data["id"])
    items = timeline(data)
    filename = f"top10_{uuid.uuid4().hex[:16]}.mp4"
    output = root / "renders" / filename
    with tempfile.TemporaryDirectory(prefix="top10_", dir=root) as temporary:
        temp = Path(temporary)
        segments = []
        for n, item in enumerate(items):
            scene = config.scenes[item.get("slot", 0)]
            asset = data["assets"].get(scene.asset_id) if item["kind"] == "scene" else None
            source = root / "files" / asset["filename"] if asset else counter_path(config.model, item["rank"])
            seconds = item["frames"] / FPS
            command = [settings.FFMPEG_BIN, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-threads", "2", "-filter_complex_threads", "1"]
            if asset:
                command += ["-ss", f"{scene.start:.6f}"]
            command += ["-i", str(source)]
            has_audio = bool(asset["has_audio"]) if asset else bool(probe_media(source).audio_codec)
            audio_index = 0
            next_input = 1
            if not has_audio:
                command += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
                audio_index, next_input = 1, 2
            zoom, x, y = (scene.zoom, scene.x, scene.y) if asset else (1, 0.5, 0.5)
            sw, sh = round(WIDTH * zoom / 2) * 2, round(HEIGHT * zoom / 2) * 2
            filters = [f"[0:v]scale={sw}:{sh}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT}:(in_w-{WIDTH})*{x}:(in_h-{HEIGHT})*{y},setsar=1,fps={FPS},tpad=stop_mode=clone:stop_duration=0.1[v]"]
            label = "v"
            headline = data.get('scene_headlines', {}).get(str(item.get('slot')))
            if asset and headline:
                caption = scene.headline
                hx = round(WIDTH * min(caption.x, 1 - caption.width))
                hy = round(HEIGHT * max(0, min(caption.y, 1 - caption.height) - .015))
                command += ['-threads', '1', '-loop', '1', '-i', str(root / 'files' / headline['filename'])]
                filters.append(f'[{label}][{next_input}:v]overlay={hx}:{hy}:format=auto[captioned]')
                next_input += 1
                label = 'captioned'
            elif asset and data.get("title_image") and config.title_enabled:
                command += ["-threads", "1", "-loop", "1", "-i", str(root / "files" / data["title_image"])]
                filters.append(f"[{label}][{next_input}:v]overlay=0:{round(HEIGHT*config.title_y)}:format=auto[title]")
                next_input += 1
                label = "title"
            logo = data["assets"].get(data.get("logo"))
            if logo and config.logo_enabled:
                logo_inputs, logo_filters = logo_overlay(logo, config, root, next_input, label, item['from'], FPS, WIDTH, HEIGHT)
                command += logo_inputs
                filters.extend(logo_filters)
                next_input += logo_inputs.count('-i')
                label = "branded"
            if config.cta_enabled:
                cta_inputs, cta_filters, cta_label = cta_overlay(
                    next_input, label, item['from'], item['frames'], sum(part['frames'] for part in items), FPS)
                command += cta_inputs
                filters.extend(cta_filters)
                label = cta_label
            # Explicit HD color metadata keeps browser PNG colors stable after H.264 export.
            filters.append(f'[{label}]scale=out_color_matrix=bt709,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709[encoded]')
            label = 'encoded'
            volume = scene.volume if asset else config.counter_volume
            filters.append(f"[{audio_index}:a]volume={volume},aresample=48000,apad[a]")
            target = temp / f"segment_{n:02d}.mov"
            # PCM avoids accumulating AAC encoder padding at twenty clip boundaries.
            command += ["-filter_complex", ";".join(filters), "-map", f"[{label}]", "-map", "[a]", "-frames:v", str(item["frames"]), "-t", f"{seconds:.6f}", "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", "4.2", "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", "-video_track_timescale", "15360", str(target)]
            _run(command, job_path)
            segments.append(target)
            _update_job(job_path, progress=round((n + 1) / len(items) * 88), stage=f"Trecho {n+1}/{len(items)}")
        concat = temp / "segments.txt"
        concat.write_text("".join(f"file '{path.name}'\nduration {item['frames']/FPS:.6f}\n" for path, item in zip(segments, items)), encoding="utf-8")
        joined = temp / "joined.mp4"
        duration = sum(item["frames"] for item in items) / FPS
        _run([settings.FFMPEG_BIN, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-t", f"{duration:.6f}", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(joined)], job_path)
        music = data["assets"].get(data.get("music"))
        final = temp / "final.mp4"
        if music and config.music_volume > 0:
            fade = max(0, duration - 0.5)
            _run([settings.FFMPEG_BIN, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(joined), "-stream_loop", "-1", "-i", str(root / "files" / music["filename"]), "-filter_complex", f"[1:a]volume={config.music_volume},afade=t=out:st={fade}:d=0.5[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[a]", "-map", "0:v", "-map", "[a]", "-t", f"{duration:.6f}", "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k", "-movflags", "+faststart", str(final)], job_path)
        else:
            shutil.copyfile(joined, final)
        probe = probe_media(final)
        if probe.video_codec != "h264" or probe.width != WIDTH or probe.height != HEIGHT or abs(probe.duration - duration) > 0.35 or final.stat().st_size < 1024:
            raise RuntimeError("O arquivo exportado nao passou na verificacao de duracao e formato")
        _update_job(job_path, progress=98, stage="Verificando MP4")
        shutil.move(final, output)
    return {"filename": filename, "duration": duration, "width": WIDTH, "height": HEIGHT, "size": output.stat().st_size, "created_at": _now()}


def stream_media(path: Path, request: Request, download: bool = False):
    size = path.stat().st_size
    if not size:
        raise HTTPException(404, "Arquivo vazio")
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"}
    if download:
        headers.update({"Content-Disposition": f'attachment; filename="{path.name}"', "Cache-Control": "no-store"})
    start, end, status = 0, size - 1, 200
    value = request.headers.get("range", "")
    if value:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", value)
        if not match or not any(match.groups()):
            return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{size}"})
        a, b = match.groups()
        start = int(a) if a else max(0, size - int(b))
        end = min(int(b), size - 1) if a and b else size - 1
        if start > end or start >= size or (not a and int(b) == 0):
            return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{size}"})
        status = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    headers["Content-Length"] = str(end - start + 1)
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if request.method == "HEAD":
        return Response(status_code=status, media_type=content_type, headers=headers)
    def chunks():
        remaining = end - start + 1
        with path.open("rb") as source:
            source.seek(start)
            while remaining:
                chunk = source.read(min(remaining, 256 * 1024))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk
    return StreamingResponse(chunks(), status_code=status, media_type=content_type, headers=headers)
