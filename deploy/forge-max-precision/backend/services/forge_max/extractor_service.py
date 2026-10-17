"""Isolated long-video scene extractor for Forge Max 3.0."""

from __future__ import annotations

import json
import logging
import os
import queue
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
import uuid
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from fractions import Fraction
from pathlib import Path
from typing import Any

from fastapi import UploadFile

from config import settings
from services.forge.ffmpeg_service import probe_media
from utils.user_context import get_current_user_context
from utils.workspace_storage import workspace_module_root


ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"}
MAX_DURATION_SECONDS = 200 * 60
MAX_SCENES = 600
MIN_SCENE_SECONDS = 0.75
SCENE_DETECTION_FLOOR = 0.03
SCENE_SOFT_CUT_THRESHOLD = 0.12
SCENE_SPARSE_INTERVAL_SECONDS = 120
MAX_UPLOAD_MB = max(2048, int(os.getenv("FORGE_MAX_EXTRACTOR_MAX_UPLOAD_MB", "20480") or "20480"))
THUMBNAIL_SEMAPHORE = threading.BoundedSemaphore(2)
THUMBNAIL_TASKS: set[str] = set()
THUMBNAIL_TASKS_GUARD = threading.Lock()
VIDEO_LOCKS: dict[str, threading.RLock] = {}
VIDEO_LOCKS_GUARD = threading.Lock()
TASKS_GUARD = threading.RLock()
TASK_SEQUENCE = 0
QUEUED_TASKS: set[str] = set()
ACTIVE_TASK_KEY = ""
ACTIVE_PROCESSES: dict[str, subprocess.Popen] = {}
CANCEL_EVENTS: dict[str, threading.Event] = {}
MEDIA_PATH_CACHE: dict[str, Path] = {}


class TaskCancelled(RuntimeError):
    pass


@dataclass(order=True)
class _QueuedTask:
    priority: int
    sequence: int
    key: str = field(compare=False)
    target: Any = field(compare=False)
    args: tuple = field(compare=False)


TASK_QUEUE: queue.PriorityQueue[_QueuedTask] = queue.PriorityQueue()
WORKER_STARTED = False
LOGGER = logging.getLogger(__name__)


def _task_priority(task_key: str) -> int:
    if task_key.startswith("clip:"):
        return 10
    if task_key.startswith("analyze:"):
        return 20
    return 30


def _task_runtime(task_key: str) -> dict[str, Any]:
    with TASKS_GUARD:
        if task_key == ACTIVE_TASK_KEY:
            return {"state": "running", "queue_position": 0}
        if task_key in QUEUED_TASKS:
            with TASK_QUEUE.mutex:
                pending = sorted(list(TASK_QUEUE.queue))
            keys = [item.key for item in pending if item.key in QUEUED_TASKS]
            try:
                position = keys.index(task_key) + 1
            except ValueError:
                position = 1
            return {"state": "queued", "queue_position": position}
    return {"state": "idle", "queue_position": 0}


def _worker_loop() -> None:
    global ACTIVE_TASK_KEY
    while True:
        task = TASK_QUEUE.get()
        try:
            with TASKS_GUARD:
                if task.key not in QUEUED_TASKS:
                    continue
                QUEUED_TASKS.discard(task.key)
                ACTIVE_TASK_KEY = task.key
                cancel_event = CANCEL_EVENTS.setdefault(task.key, threading.Event())
            if not cancel_event.is_set():
                task.target(*task.args, task_key=task.key, cancel_event=cancel_event)
        except Exception as exc:
            LOGGER.exception("Forge Max task failed: %s", task.key)
            if task.args and isinstance(task.args[0], Path):
                def fail(item: dict[str, Any]) -> None:
                    if task.key.startswith("analyze:"):
                        item["analysis_status"] = "error"
                        item["analysis_error"] = str(exc)
                    elif task.key.startswith("clip:"):
                        clip_id = task.key.rsplit(":", 1)[-1]
                        clip = next((clip for clip in item.get("clips", []) if clip.get("id") == clip_id), None)
                        if clip:
                            clip["status"] = "error"
                            clip["error"] = str(exc)
                    else:
                        item["status"] = "error"
                        item["error"] = str(exc)
                try:
                    _mutate_manifest(task.args[0], fail)
                except Exception:
                    LOGGER.exception("Forge Max could not record task failure: %s", task.key)
        finally:
            with TASKS_GUARD:
                if ACTIVE_TASK_KEY == task.key:
                    ACTIVE_TASK_KEY = ""
                ACTIVE_PROCESSES.pop(task.key, None)
                CANCEL_EVENTS.pop(task.key, None)
            TASK_QUEUE.task_done()


def _ensure_worker() -> None:
    global WORKER_STARTED
    with TASKS_GUARD:
        if WORKER_STARTED:
            return
        WORKER_STARTED = True
        threading.Thread(target=_worker_loop, daemon=True, name="forge-max-worker").start()


def _now() -> str:
    return datetime.now().isoformat()


def _scope_root() -> Path:
    return workspace_module_root("forge_max_extractor")


def _videos_root() -> Path:
    root = (_scope_root() / "videos").resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _validate_video_id(video_id: str) -> str:
    if not re.fullmatch(r"extractor_[a-f0-9]{16}", video_id or ""):
        raise ValueError("ID de vídeo inválido")
    return video_id


def _validate_clip_id(clip_id: str) -> str:
    if not re.fullmatch(r"extract_[a-f0-9]{16}", clip_id or ""):
        raise ValueError("ID de trecho inválido")
    return clip_id


def _video_dir(video_id: str) -> Path:
    _validate_video_id(video_id)
    root = _videos_root()
    path = (root / video_id).resolve()
    if path.parent != root:
        raise ValueError("Caminho de vídeo inválido")
    return path


def _manifest_path(video_dir: Path) -> Path:
    return video_dir / "video.json"


def _video_lock(video_id: str) -> threading.RLock:
    with VIDEO_LOCKS_GUARD:
        return VIDEO_LOCKS.setdefault(video_id, threading.RLock())


def _read_manifest_from_dir(video_dir: Path) -> dict[str, Any]:
    path = _manifest_path(video_dir)
    if not path.exists():
        raise FileNotFoundError("Vídeo do extrator não encontrado")
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except PermissionError as exc:
            last_error = exc
            if attempt < 4:
                time.sleep(0.02 * (attempt + 1))
                continue
        except (OSError, json.JSONDecodeError) as exc:
            last_error = exc
        break
    raise RuntimeError("Manifesto do vídeo está corrompido") from last_error


def _read_manifest(video_id: str) -> dict[str, Any]:
    return _read_manifest_from_dir(_video_dir(video_id))


def _write_manifest(video_dir: Path, payload: dict[str, Any]) -> None:
    payload["updated_at"] = _now()
    path = _manifest_path(video_dir)
    temp = path.with_suffix(".json.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(path)


def _mutate_manifest(video_dir: Path, mutation) -> dict[str, Any]:
    video_id = video_dir.name
    with _video_lock(video_id):
        payload = _read_manifest_from_dir(video_dir)
        mutation(payload)
        _write_manifest(video_dir, payload)
        return payload


def _spawn_task(task_key: str, target, *args) -> bool:
    global TASK_SEQUENCE
    _ensure_worker()
    with TASKS_GUARD:
        if task_key == ACTIVE_TASK_KEY or task_key in QUEUED_TASKS:
            return False
        TASK_SEQUENCE += 1
        QUEUED_TASKS.add(task_key)
        CANCEL_EVENTS[task_key] = threading.Event()
        TASK_QUEUE.put(_QueuedTask(_task_priority(task_key), TASK_SEQUENCE, task_key, target, args))
    return True


def _cancel_task_process(task_key: str) -> bool:
    with TASKS_GUARD:
        event = CANCEL_EVENTS.get(task_key)
        process = ACTIVE_PROCESSES.get(task_key)
        queued = task_key in QUEUED_TASKS
        if event:
            event.set()
        if queued:
            QUEUED_TASKS.discard(task_key)
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
    return bool(event or process or queued)


def _resume_pending(video_dir: Path, payload: dict[str, Any]) -> None:
    video_id = payload.get("id") or video_dir.name
    if payload.get("status") == "preparing":
        _spawn_task(f"prepare:{video_id}", _prepare_video, video_dir)
    if payload.get("analysis_status") == "running":
        _spawn_task(
            f"analyze:{video_id}",
            _analyze_scenes,
            video_dir,
            float(payload.get("scene_threshold") or 0.30),
        )
    for clip in payload.get("clips", []):
        if clip.get("status") == "extracting" and clip.get("id"):
            _spawn_task(f"clip:{video_id}:{clip['id']}", _extract_clip, video_dir, clip["id"])


def _media_query(payload: dict[str, Any]) -> str:
    return f"?key={payload.get('media_key', '')}"


def _public_clip(video_id: str, clip: dict[str, Any], media_key: str) -> dict[str, Any]:
    result = {key: value for key, value in clip.items() if key != "path"}
    result["task"] = _task_runtime(f"clip:{video_id}:{clip.get('id', '')}")
    if clip.get("status") == "ready" and clip.get("filename"):
        query = f"?key={media_key}"
        result["download_url"] = f"/api/forge-max/extractor/videos/{video_id}/clips/{clip['id']}/download{query}"
        result["preview_url"] = f"/api/forge-max/extractor/videos/{video_id}/clips/{clip['id']}/preview{query}"
    return result


def _public_video(payload: dict[str, Any]) -> dict[str, Any]:
    video_id = payload["id"]
    result = {
        key: value
        for key, value in payload.items()
        if key not in {"source_path", "proxy_path", "waveform_path"}
    }
    result["source_url"] = f"/api/forge-max/extractor/videos/{video_id}/source"
    query = _media_query(payload)
    result["source_url"] += query
    result["playback_url"] = (
        f"/api/forge-max/extractor/videos/{video_id}/proxy{query}"
        if payload.get("proxy_ready")
        else result["source_url"]
    )
    result["waveform_url"] = (
        f"/api/forge-max/extractor/videos/{video_id}/waveform{query}"
        if payload.get("waveform_ready")
        else ""
    )
    result["prepare_task"] = _task_runtime(f"prepare:{video_id}")
    result["analysis_task"] = _task_runtime(f"analyze:{video_id}")
    result["clips"] = [_public_clip(video_id, item, payload.get("media_key", "")) for item in payload.get("clips", [])]
    MEDIA_PATH_CACHE[video_id] = _manifest_path(Path(payload["source_path"]).parent.parent)
    return result


def _run(args: list[str], timeout: int) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, check=False, timeout=timeout)


def _run_job(
    args: list[str],
    timeout: int,
    task_key: str,
    cancel_event: threading.Event,
    *,
    duration: float = 0,
    progress_callback=None,
) -> subprocess.CompletedProcess:
    command = list(args)
    is_ffmpeg = "ffmpeg" in Path(command[0]).name.lower()
    if is_ffmpeg:
        command[1:1] = ["-progress", "pipe:1", "-nostats", "-threads", "1", "-filter_threads", "1"]
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    with TASKS_GUARD:
        ACTIVE_PROCESSES[task_key] = process
    started = time.monotonic()
    stdout_lines: list[str] = []
    stderr_lines: list[str] = []
    progress_errors: list[Exception] = []

    def read_stdout() -> None:
        if not process.stdout:
            return
        for line in process.stdout:
            stdout_lines.append(line)
            if progress_callback and duration > 0 and line.startswith(("out_time_us=", "out_time_ms=")):
                try:
                    current = float(line.split("=", 1)[1].strip()) / 1_000_000
                    progress_callback(min(99, max(1, round((current / duration) * 100))))
                except (TypeError, ValueError):
                    pass
                except Exception as exc:
                    progress_errors.append(exc)

    def read_stderr() -> None:
        if not process.stderr:
            return
        stderr_lines.extend(process.stderr)

    stdout_reader = threading.Thread(target=read_stdout, daemon=True, name=f"{task_key}-stdout")
    stderr_reader = threading.Thread(target=read_stderr, daemon=True, name=f"{task_key}-stderr")
    stdout_reader.start()
    stderr_reader.start()
    try:
        while process.poll() is None:
            if progress_errors:
                process.kill()
                process.wait(timeout=5)
                raise RuntimeError("Falha ao salvar o progresso do Forge Max") from progress_errors[0]
            if cancel_event.is_set():
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
                raise TaskCancelled("Operação cancelada")
            if time.monotonic() - started > timeout:
                process.kill()
                process.wait(timeout=5)
                raise subprocess.TimeoutExpired(command, timeout)
            time.sleep(0.05)
        stdout_reader.join(timeout=5)
        stderr_reader.join(timeout=5)
        if progress_errors:
            raise RuntimeError("Falha ao salvar o progresso do Forge Max") from progress_errors[0]
        if cancel_event.is_set():
            raise TaskCancelled("Operação cancelada")
        return subprocess.CompletedProcess(command, process.returncode, "".join(stdout_lines), "".join(stderr_lines))
    finally:
        stdout_reader.join(timeout=1)
        stderr_reader.join(timeout=1)
        if process.stdout:
            process.stdout.close()
        if process.stderr:
            process.stderr.close()
        with TASKS_GUARD:
            ACTIVE_PROCESSES.pop(task_key, None)


def _ffmpeg_error(result: subprocess.CompletedProcess, fallback: str) -> RuntimeError:
    lines = (result.stderr or "").strip().splitlines()
    detail = "\n".join(lines[-12:]) if lines else fallback
    return RuntimeError(detail or fallback)


def _source_frame_timing(source: Path) -> tuple[Fraction | None, int | None]:
    result = _run([settings.FFPROBE_BIN, '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=r_frame_rate,avg_frame_rate,nb_frames', '-of', 'json', str(source)], timeout=60)
    if result.returncode != 0:
        raise _ffmpeg_error(result, 'Nao foi possivel conferir os quadros do video original')
    stream = (json.loads(result.stdout or '{}').get('streams') or [{}])[0]
    try:
        rate = Fraction(stream.get('r_frame_rate') or '0/1')
        average = Fraction(stream.get('avg_frame_rate') or '0/1')
    except (ValueError, ZeroDivisionError):
        return None, None
    # Do not impose a fixed frame grid on variable-rate sources.
    if rate <= 0 or rate != average:
        return None, None
    count = stream.get('nb_frames')
    return rate, int(count) if str(count).isdigit() else None


def _frame_window(start: float, end: float, rate: Fraction, total_frames: int | None) -> tuple[float, float, int]:
    first = max(0, round(Fraction(str(start)) * rate))
    last = max(first + 1, round(Fraction(str(end)) * rate))
    if total_frames is not None:
        last = min(last, total_frames)
    if last <= first:
        raise ValueError('O corte nao contem quadros do video original')
    return float(first / rate), float(last / rate), last - first


def _create_video_from_source(source_input: Path, original_name: str, *, move_source: bool) -> dict[str, Any]:
    original_name = Path(original_name or "video.mp4").name
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValueError("Formato inválido. Envie MP4, MOV, M4V, MKV, WEBM ou AVI")
    video_id = f"extractor_{uuid.uuid4().hex[:16]}"
    video_dir = _video_dir(video_id)
    source_dir = video_dir / "source"
    source_dir.mkdir(parents=True, exist_ok=False)
    (video_dir / "proxy").mkdir()
    (video_dir / "thumbnails").mkdir()
    (video_dir / "clips").mkdir()
    source_path = source_dir / f"original{extension}"
    try:
        if not source_input.is_file() or source_input.stat().st_size <= 0:
            raise ValueError("O arquivo enviado está vazio")
        if source_input.stat().st_size > MAX_UPLOAD_MB * 1024 * 1024:
            raise ValueError(f"O vídeo ultrapassa o limite de {MAX_UPLOAD_MB} MB")
        if move_source:
            os.replace(source_input, source_path)
        else:
            shutil.copy2(source_input, source_path)
        info = probe_media(source_path)
        source_rate, _ = _source_frame_timing(source_path)
        if info.duration <= 0:
            raise ValueError("Não foi possível identificar a duração do vídeo")
        if info.width <= 0 or info.height <= 0 or not info.video_codec:
            raise ValueError("O arquivo enviado não contém uma faixa de vídeo válida")
        if info.duration > MAX_DURATION_SECONDS + 1:
            raise ValueError("O vídeo ultrapassa o limite de 200 minutos")

        payload: dict[str, Any] = {
            "id": video_id,
            "original_name": original_name,
            "filename": source_path.name,
            "source_path": str(source_path),
            "proxy_path": str(video_dir / "proxy" / "preview.mp4"),
            "waveform_path": str(video_dir / "proxy" / "waveform.png"),
            "duration": round(float(info.duration), 3),
            "frame_rate": float(source_rate) if source_rate else 0,
            "width": int(info.width),
            "height": int(info.height),
            "size_bytes": int(info.size_bytes),
            "video_codec": info.video_codec,
            "audio_codec": info.audio_codec,
            "media_key": secrets.token_urlsafe(32),
            "status": "preparing",
            "status_detail": "Criando prévia leve para a timeline",
            "prepare_progress": 0,
            "prepare_attempts": 1,
            "error": "",
            "proxy_ready": False,
            "waveform_ready": False,
            "analysis_status": "pending",
            "analysis_progress": 0,
            "analysis_attempts": 0,
            "analysis_error": "",
            "scene_threshold": 0.30,
            "scenes": [],
            "thumbnail_status": "pending",
            "thumbnail_progress": 0,
            "clips": [],
            "created_at": _now(),
            "updated_at": _now(),
        }
        _write_manifest(video_dir, payload)
        _spawn_task(f"prepare:{video_id}", _prepare_video, video_dir)
        return _public_video(payload)
    except Exception:
        if move_source and source_path.is_file() and not source_input.exists():
            source_input.parent.mkdir(parents=True, exist_ok=True)
            os.replace(source_path, source_input)
        shutil.rmtree(video_dir, ignore_errors=True)
        raise


async def add_video(file: UploadFile) -> dict[str, Any]:
    original_name = Path(file.filename or "video.mp4").name
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValueError("Formato inválido. Envie MP4, MOV, M4V, MKV, WEBM ou AVI")
    temporary_root = (_scope_root() / "incoming").resolve()
    temporary_root.mkdir(parents=True, exist_ok=True)
    temporary = temporary_root / f"upload_{uuid.uuid4().hex}{extension}"
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    total = 0
    try:
        with temporary.open("wb") as target:
            while chunk := await file.read(8 * 1024 * 1024):
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError(f"O vídeo ultrapassa o limite de {MAX_UPLOAD_MB} MB")
                target.write(chunk)
        return _create_video_from_source(temporary, original_name, move_source=True)
    finally:
        temporary.unlink(missing_ok=True)
        await file.close()


def import_resumable_video(source: Path, original_name: str) -> dict[str, Any]:
    return _create_video_from_source(source.resolve(), original_name, move_source=True)


def _progress_writer(video_dir: Path, field_name: str, *, minimum_interval: float = 1.0):
    last_progress = -1
    last_write = 0.0

    def update(progress: int) -> None:
        nonlocal last_progress, last_write
        normalized = max(0, min(100, int(progress)))
        now = time.monotonic()
        if normalized == last_progress or (normalized < 100 and now - last_write < minimum_interval):
            return

        def mutate(item: dict[str, Any]) -> None:
            item[field_name] = normalized

        _mutate_manifest(video_dir, mutate)
        last_progress = normalized
        last_write = now

    return update


def _prepare_video(video_dir: Path, *, task_key: str, cancel_event: threading.Event) -> None:
    try:
        payload = _read_manifest_from_dir(video_dir)
        source = Path(payload["source_path"])
        proxy = Path(payload["proxy_path"])
        waveform = Path(payload["waveform_path"])
        proxy.parent.mkdir(parents=True, exist_ok=True)
        update_progress = _progress_writer(video_dir, "prepare_progress")
        result = _run_job([
            settings.FFMPEG_BIN, "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(source),
            "-map", "0:v:0", "-map", "0:a:0?",
            "-vf", "scale='min(960,iw)':-2:flags=lanczos",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
            "-threads", "1", "-pix_fmt", "yuv420p", "-tag:v", "avc1",
            "-c:a", "aac", "-b:a", "96k",
            "-movflags", "+faststart", str(proxy),
        ], timeout=14400, task_key=task_key, cancel_event=cancel_event,
            duration=float(payload.get("duration") or 0), progress_callback=update_progress)
        if result.returncode != 0:
            raise _ffmpeg_error(result, "Falha ao criar a prévia leve")

        waveform_ready = False
        if payload.get("audio_codec") and not cancel_event.is_set():
            update_progress(96)
            wave_result = _run([
                settings.FFMPEG_BIN, "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(source), "-filter_complex",
                "aformat=channel_layouts=mono,showwavespic=s=2400x120:colors=0x48ff8a",
                "-frames:v", "1", str(waveform),
            ], timeout=1800)
            waveform_ready = wave_result.returncode == 0 and waveform.exists()
        if cancel_event.is_set():
            raise TaskCancelled("Preparação cancelada")

        def complete(item: dict[str, Any]) -> None:
            item["proxy_ready"] = proxy.exists()
            item["waveform_ready"] = waveform_ready
            item["prepare_progress"] = 100
            item["status"] = "ready"
            item["status_detail"] = "Pronto para detectar e cortar cenas"
            item["error"] = ""

        _mutate_manifest(video_dir, complete)
    except TaskCancelled:
        proxy = Path(_read_manifest_from_dir(video_dir).get("proxy_path") or "")
        proxy.unlink(missing_ok=True)

        def cancelled(item: dict[str, Any]) -> None:
            item["status"] = "cancelled"
            item["status_detail"] = "Preparação cancelada"
            item["error"] = ""

        _mutate_manifest(video_dir, cancelled)
    except Exception as exc:
        def fail(item: dict[str, Any]) -> None:
            item["status"] = "error"
            item["status_detail"] = "Falha ao preparar o vídeo"
            item["error"] = str(exc)

        try:
            _mutate_manifest(video_dir, fail)
        except Exception:
            pass


def list_videos() -> list[dict[str, Any]]:
    videos: list[dict[str, Any]] = []
    for path in _videos_root().glob("extractor_*/video.json"):
        try:
            payload = _read_manifest_from_dir(path.parent)
            _resume_pending(path.parent, payload)
            videos.append(_public_video(payload))
        except Exception:
            continue
    return sorted(videos, key=lambda item: item.get("created_at", ""), reverse=True)


def get_video(video_id: str) -> dict[str, Any]:
    video_dir = _video_dir(video_id)
    payload = _read_manifest_from_dir(video_dir)
    _resume_pending(video_dir, payload)
    return _public_video(payload)


def delete_video(video_id: str) -> None:
    payload = _read_manifest(video_id)
    if payload.get("status") == "preparing" or payload.get("analysis_status") == "running" or any(
        clip.get("status") == "extracting" for clip in payload.get("clips", [])
    ):
        raise ValueError("Aguarde o processamento atual terminar antes de excluir")
    shutil.rmtree(_video_dir(video_id))
    MEDIA_PATH_CACHE.pop(video_id, None)
    with VIDEO_LOCKS_GUARD:
        VIDEO_LOCKS.pop(video_id, None)


def start_scene_analysis(video_id: str, threshold: float) -> dict[str, Any]:
    video_dir = _video_dir(video_id)
    threshold = max(0.12, min(float(threshold), 0.75))

    def mark(item: dict[str, Any]) -> None:
        if item.get("status") not in {"ready", "error"}:
            raise ValueError("A prévia ainda está sendo preparada")
        if item.get("analysis_status") == "running":
            raise ValueError("A detecção de cenas já está em andamento")
        item["analysis_status"] = "running"
        item["analysis_progress"] = 0
        item["analysis_attempts"] = int(item.get("analysis_attempts") or 0) + 1
        item["analysis_error"] = ""
        item["scene_threshold"] = threshold
        item["thumbnail_status"] = "pending"
        item["thumbnail_progress"] = 0

    payload = _mutate_manifest(video_dir, mark)
    _spawn_task(f"analyze:{video_id}", _analyze_scenes, video_dir, threshold)
    return _public_video(payload)


def _merge_boundaries(boundaries: list[float], duration: float) -> list[tuple[float, float]]:
    points = sorted({round(max(0.0, min(duration, value)), 9) for value in [0.0, *boundaries, duration]})
    segments: list[tuple[float, float]] = []
    start = points[0] if points else 0.0
    for end in points[1:]:
        if end - start < MIN_SCENE_SECONDS and end < duration:
            continue
        segments.append((start, end))
        start = end
    if start < duration:
        if segments and duration - start < MIN_SCENE_SECONDS:
            previous = segments.pop()
            segments.append((previous[0], duration))
        else:
            segments.append((start, duration))
    if len(segments) > MAX_SCENES:
        group_size = max(2, (len(segments) + MAX_SCENES - 1) // MAX_SCENES)
        grouped: list[tuple[float, float]] = []
        for index in range(0, len(segments), group_size):
            group = segments[index:index + group_size]
            grouped.append((group[0][0], group[-1][1]))
        segments = grouped
    return segments


def _parse_scene_events(output: str) -> list[tuple[float, float]]:
    events: list[tuple[float, float]] = []
    pending_time: float | None = None
    for line in output.splitlines():
        frame_match = re.search(r"\bpts_time:([0-9]+(?:\.[0-9]+)?)", line)
        if frame_match:
            pending_time = float(frame_match.group(1))
            continue
        score_match = re.search(r"lavfi\.scene_score=([0-9]+(?:\.[0-9]+)?)", line)
        if score_match and pending_time is not None:
            events.append((pending_time, float(score_match.group(1))))
            pending_time = None
    return events


def _refine_scene_segments(segments: list[tuple[float,float]], refinements: list[dict]) -> list[tuple[float,float]]:
    if not segments or not refinements:
        return segments
    points=[segments[0][0],*[end for _,end in segments]]
    # Refine only after compaction. A real short shot must not disappear simply
    # because its correctly aligned edge falls just below the detection minimum.
    for index in range(1,len(points)-1):
        match=next((entry for entry in refinements if abs(entry['candidate']-points[index])<.00001),None)
        if match:
            proposed=round(float(match['refined']),9)
            if points[index-1]+.25 <= proposed <= points[index+1]-.25:
                points[index]=proposed
    return list(zip(points,points[1:]))


def _choose_scene_boundaries(
    events: list[tuple[float, float]],
    requested_threshold: float,
    duration: float,
) -> tuple[list[float], float]:
    requested_threshold = round(max(SCENE_DETECTION_FLOOR, min(float(requested_threshold), 0.75)), 3)
    preferred = [timestamp for timestamp, score in events if score >= requested_threshold]
    preferred_segments = _merge_boundaries(preferred, duration)
    soft_threshold = min(requested_threshold, SCENE_SOFT_CUT_THRESHOLD)
    soft = [timestamp for timestamp, score in events if score >= soft_threshold]
    soft_segments = _merge_boundaries(soft, duration)
    sparse = any(end - start >= SCENE_SPARSE_INTERVAL_SECONDS for start, end in preferred_segments)

    # A handful of strong cuts must not hide the softer cuts in a long video.
    # Try reliable soft cuts before the noise floor, which also sees camera motion.
    if len(soft_segments) > len(preferred_segments) and (not preferred or sparse):
        return soft, soft_threshold
    if len(preferred_segments) > 1:
        return preferred, requested_threshold

    # When the chosen value misses soft cuts, keep every reliable event from
    # the same decode pass instead of stopping after the first weak match.
    fallback = [timestamp for timestamp, score in events if score >= SCENE_DETECTION_FLOOR]
    return fallback, SCENE_DETECTION_FLOOR


def _analyze_scenes(
    video_dir: Path,
    threshold: float,
    *,
    task_key: str,
    cancel_event: threading.Event,
) -> None:
    try:
        payload = _read_manifest_from_dir(video_dir)
        source = Path(payload["proxy_path"]) if payload.get("proxy_ready") else Path(payload["source_path"])
        duration = float(payload.get("duration") or 0)
        update_progress = _progress_writer(video_dir, "analysis_progress")

        def started(item: dict[str, Any]) -> None:
            item["analysis_progress"] = 1

        _mutate_manifest(video_dir, started)
        result = _run_job([
            sys.executable, str(Path(__file__).with_name("scene_detector.py")), str(source),
            "--threshold", str(threshold), "--duration", str(duration),
        ], timeout=14400, task_key=task_key, cancel_event=cancel_event,
            duration=duration, progress_callback=update_progress)
        if result.returncode != 0:
            raise _ffmpeg_error(result, "Falha ao detectar cenas")
        if cancel_event.is_set():
            raise TaskCancelled("Detecção cancelada")
        records = [line.removeprefix("SCENE_RESULT=") for line in (result.stdout or "").splitlines()
                   if line.startswith("SCENE_RESULT=")]
        if len(records) != 1:
            raise RuntimeError("O detector nao entregou um resultado completo")
        detection = json.loads(records[0])
        source_rate, _ = _source_frame_timing(Path(payload['source_path']))
        boundaries = detection["boundaries"]
        segments = _refine_scene_segments(_merge_boundaries(boundaries, duration), detection.get('boundary_refinements',[]))
        scenes = [
            {
                "id": f"scene_{index:04d}",
                "index": index,
                "start_seconds": round(start, 9),
                "end_seconds": round(end, 9),
                "duration": round(end - start, 9),
                "label": f"Cena {index}",
            }
            for index, (start, end) in enumerate(segments, start=1)
        ]

        def complete(item: dict[str, Any]) -> None:
            item["scenes"] = scenes
            item["analysis_status"] = "ready"
            item["analysis_progress"] = 100
            item["analysis_error"] = ""
            item["scene_threshold_effective"] = threshold
            item["scene_detection_fallback"] = False
            item["scene_detection_engine"] = detection["engine"]
            item["scene_decoded_frames"] = detection["decoded_frames"]
            item['frame_rate'] = float(source_rate) if source_rate else 0
            item['scene_boundary_precision'] = detection.get('boundary_precision','legacy')

        _mutate_manifest(video_dir, complete)
        _start_thumbnail_preparation(video_dir, scenes)
    except TaskCancelled:
        def cancelled(item: dict[str, Any]) -> None:
            item["analysis_status"] = "cancelled"
            item["analysis_error"] = ""

        _mutate_manifest(video_dir, cancelled)
    except Exception as exc:
        def fail(item: dict[str, Any]) -> None:
            item["analysis_status"] = "error"
            item["analysis_error"] = str(exc)

        try:
            _mutate_manifest(video_dir, fail)
        except Exception:
            pass


def _invalidate_archives(video_dir: Path) -> None:
    export_dir = video_dir / "exports"
    if not export_dir.exists():
        return
    for path in export_dir.glob("forge_max_cenas_*.zip"):
        path.unlink(missing_ok=True)


def _validate_mp4(path: Path, expected_duration: float, task_key: str, cancel_event: threading.Event, expected_frames: int | None = None) -> Any:
    if not path.is_file() or path.stat().st_size <= 1024:
        raise RuntimeError("O MP4 extraído ficou vazio ou incompleto")
    info = probe_media(path)
    if info.video_codec != "h264":
        raise RuntimeError("O MP4 extraído não ficou em H.264")
    if info.duration <= 0 or abs(float(info.duration) - expected_duration) > max(1.0, expected_duration * 0.03):
        raise RuntimeError("A duração do MP4 extraído não confere com o corte")
    probe = _run([
        settings.FFPROBE_BIN, "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=pix_fmt,codec_tag_string,nb_frames", "-of", "json", str(path),
    ], timeout=60)
    if probe.returncode != 0:
        raise RuntimeError("Não foi possível validar a compatibilidade do MP4")
    try:
        stream = (json.loads(probe.stdout or "{}").get("streams") or [{}])[0]
    except (IndexError, TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Os dados de compatibilidade do MP4 estão inválidos") from exc
    if stream.get("pix_fmt") != "yuv420p" or str(stream.get("codec_tag_string") or "").lower() != "avc1":
        raise RuntimeError("O MP4 não ficou compatível com navegadores e Windows")
    if expected_frames is not None and str(stream.get('nb_frames')) != str(expected_frames):
        raise RuntimeError('O numero de quadros do MP4 nao confere com o corte selecionado')
    decode = _run_job([
        settings.FFMPEG_BIN, "-hide_banner", "-loglevel", "error", "-i", str(path),
        "-map", "0:v:0", "-f", "null", "-",
    ], timeout=max(300, min(14400, int(expected_duration * 6) + 120)),
        task_key=task_key, cancel_event=cancel_event)
    if decode.returncode != 0:
        raise _ffmpeg_error(decode, "O MP4 falhou na validação completa")
    return info


def create_clip(video_id: str, title: str, start_seconds: float, end_seconds: float, mode: str) -> dict[str, Any]:
    video_dir = _video_dir(video_id)
    payload = _read_manifest_from_dir(video_dir)
    duration = float(payload.get("duration") or 0)
    start = max(0.0, min(float(start_seconds), duration))
    end = max(start, min(float(end_seconds), duration))
    if end - start < 0.25:
        raise ValueError("O trecho precisa ter pelo menos 0,25 segundo")
    if end - start > MAX_DURATION_SECONDS:
        raise ValueError("O trecho ultrapassa 200 minutos")
    mode = mode if mode in {"fast", "precise"} else "precise"
    clip_id = f"extract_{uuid.uuid4().hex[:16]}"
    safe_title = re.sub(r"[^a-zA-Z0-9_-]+", "_", (title or "reportagem").strip()).strip("_")[:70] or "reportagem"
    filename = f"{safe_title}_{clip_id[-6:]}.mp4"
    clip = {
        "id": clip_id,
        "title": (title or "Trecho extraído").strip()[:120],
        "filename": filename,
        "path": str(video_dir / "clips" / filename),
        "start_seconds": round(start, 9),
        "end_seconds": round(end, 9),
        "duration": round(end - start, 9),
        "mode": mode,
        "status": "extracting",
        "progress": 0,
        "attempts": 1,
        "status_detail": "Aguardando na fila de extração",
        "error": "",
        "size_bytes": 0,
        "created_at": _now(),
    }

    def append(item: dict[str, Any]) -> None:
        item.setdefault("clips", []).append(clip)
        _invalidate_archives(video_dir)

    _mutate_manifest(video_dir, append)
    _spawn_task(f"clip:{video_id}:{clip_id}", _extract_clip, video_dir, clip_id)
    return _public_clip(video_id, clip, payload.get("media_key", ""))


def _extract_clip(
    video_dir: Path,
    clip_id: str,
    *,
    task_key: str,
    cancel_event: threading.Event,
) -> None:
    output = Path(".")
    try:
        payload = _read_manifest_from_dir(video_dir)
        clip = next(item for item in payload.get("clips", []) if item.get("id") == clip_id)
        source = Path(payload["source_path"])
        output = Path(clip["path"])
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_suffix(".working.mp4")
        temporary.unlink(missing_ok=True)
        start = float(clip["start_seconds"])
        end = float(clip['end_seconds'])
        rate, source_frames = _source_frame_timing(source)
        expected_frames = None
        if rate:
            start, end, expected_frames = _frame_window(start, end, rate, source_frames)
        duration = end - start
        last_clip_progress = -1
        last_clip_write = 0.0

        def set_clip_progress(progress: int, detail: str = "Extraindo trecho") -> None:
            nonlocal last_clip_progress, last_clip_write
            normalized = min(85, round(max(0, progress) * 0.85))
            now = time.monotonic()
            if normalized == last_clip_progress or (normalized < 85 and now - last_clip_write < 1.0):
                return

            def mutate(item: dict[str, Any]) -> None:
                target = next(value for value in item.get("clips", []) if value.get("id") == clip_id)
                target["progress"] = normalized
                target["status_detail"] = detail

            _mutate_manifest(video_dir, mutate)
            last_clip_progress = normalized
            last_clip_write = now

        args = [
            settings.FFMPEG_BIN, "-y", "-hide_banner", "-loglevel", "error",
            "-ss", f"{max(0, start - 0.000001) if rate else start:.9f}", "-i", str(source), "-t", f"{duration:.9f}",
            "-map", "0:v:0", "-map", "0:a:0?",
            "-vf", "setpts=PTS-STARTPTS", "-fps_mode", "passthrough",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-threads", "1",
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-tag:v", "avc1",
            "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k",
            "-avoid_negative_ts", "make_zero", "-max_muxing_queue_size", "2048",
            "-movflags", "+faststart", str(temporary),
        ]
        if expected_frames is not None:
            # An exclusive frame count prevents the next scene entering at a
            # rounded end timestamp; the seek guard retains the first chosen frame.
            args[-1:-1] = ['-frames:v', str(expected_frames)]
        result = _run_job(args, timeout=14400, task_key=task_key, cancel_event=cancel_event,
                          duration=duration, progress_callback=set_clip_progress)
        if result.returncode != 0 or not temporary.exists():
            raise _ffmpeg_error(result, "Falha ao extrair o trecho")

        set_clip_progress(100, "Validando MP4 completo")
        info = _validate_mp4(temporary, duration, task_key, cancel_event, expected_frames)
        if cancel_event.is_set():
            raise TaskCancelled("Extração cancelada")
        os.replace(temporary, output)

        def complete(item: dict[str, Any]) -> None:
            target = next(value for value in item.get("clips", []) if value.get("id") == clip_id)
            target["status"] = "ready"
            target["progress"] = 100
            target["status_detail"] = "MP4 validado e pronto"
            target["error"] = ""
            target["size_bytes"] = output.stat().st_size
            target["duration"] = round(float(info.duration), 3)
            target['start_seconds'] = round(start, 9)
            target['end_seconds'] = round(end, 9)
            target['frame_count'] = expected_frames
            target['cut_precision'] = 'frame_exact_v1' if rate else 'source_timestamps'
            item['frame_rate'] = float(rate) if rate else 0
            _invalidate_archives(video_dir)

        _mutate_manifest(video_dir, complete)
    except TaskCancelled:
        if output.name not in {"", "."}:
            output.with_suffix(".working.mp4").unlink(missing_ok=True)

        def cancelled(item: dict[str, Any]) -> None:
            target = next((value for value in item.get("clips", []) if value.get("id") == clip_id), None)
            if target:
                target["status"] = "cancelled"
                target["status_detail"] = "Extração cancelada"
                target["error"] = ""

        _mutate_manifest(video_dir, cancelled)
    except Exception as exc:
        if output.name not in {"", "."}:
            output.with_suffix(".working.mp4").unlink(missing_ok=True)

        def fail(item: dict[str, Any]) -> None:
            target = next((value for value in item.get("clips", []) if value.get("id") == clip_id), None)
            if target:
                target["status"] = "error"
                target["status_detail"] = "Falha na extração"
                target["error"] = str(exc)

        try:
            _mutate_manifest(video_dir, fail)
        except Exception:
            pass


def delete_clip(video_id: str, clip_id: str) -> None:
    _validate_clip_id(clip_id)
    video_dir = _video_dir(video_id)

    def remove(item: dict[str, Any]) -> None:
        clips = item.get("clips", [])
        target = next((value for value in clips if value.get("id") == clip_id), None)
        if not target:
            raise FileNotFoundError("Trecho não encontrado")
        if target.get("status") == "extracting":
            raise ValueError("Aguarde a extração terminar")
        path = Path(target.get("path") or "")
        if path.exists() and path.parent.resolve() == (video_dir / "clips").resolve():
            path.unlink()
        item["clips"] = [value for value in clips if value.get("id") != clip_id]
        _invalidate_archives(video_dir)

    _mutate_manifest(video_dir, remove)


def cancel_task(video_id: str, task_type: str, clip_id: str = "") -> dict[str, Any]:
    video_dir = _video_dir(video_id)
    if task_type == "prepare":
        task_key = f"prepare:{video_id}"
    elif task_type == "analysis":
        task_key = f"analyze:{video_id}"
    elif task_type == "clip":
        _validate_clip_id(clip_id)
        task_key = f"clip:{video_id}:{clip_id}"
    else:
        raise ValueError("Tarefa inválida")
    if not _cancel_task_process(task_key):
        raise ValueError("A tarefa não está aguardando nem em execução")

    def mark(item: dict[str, Any]) -> None:
        if task_type == "prepare":
            item["status"] = "cancelled"
            item["status_detail"] = "Preparação cancelada"
        elif task_type == "analysis":
            item["analysis_status"] = "cancelled"
            item["analysis_error"] = ""
        else:
            target = next((value for value in item.get("clips", []) if value.get("id") == clip_id), None)
            if not target:
                raise FileNotFoundError("Trecho não encontrado")
            target["status"] = "cancelled"
            target["status_detail"] = "Extração cancelada"
            target["error"] = ""

    return _public_video(_mutate_manifest(video_dir, mark))


def retry_task(video_id: str, task_type: str, clip_id: str = "") -> dict[str, Any]:
    video_dir = _video_dir(video_id)
    payload = _read_manifest_from_dir(video_dir)
    if task_type == "prepare":
        if payload.get("status") not in {"error", "cancelled"}:
            raise ValueError("A preparação não precisa ser repetida")

        def mark_prepare(item: dict[str, Any]) -> None:
            item["status"] = "preparing"
            item["status_detail"] = "Aguardando na fila de preparação"
            item["prepare_progress"] = 0
            item["prepare_attempts"] = int(item.get("prepare_attempts") or 0) + 1
            item["error"] = ""

        payload = _mutate_manifest(video_dir, mark_prepare)
        _spawn_task(f"prepare:{video_id}", _prepare_video, video_dir)
    elif task_type == "analysis":
        if payload.get("analysis_status") not in {"error", "cancelled"}:
            raise ValueError("A detecção não precisa ser repetida")
        return start_scene_analysis(
            video_id,
            float(payload.get("scene_threshold") or 0.30),
        )
    elif task_type == "clip":
        _validate_clip_id(clip_id)
        clip = next((value for value in payload.get("clips", []) if value.get("id") == clip_id), None)
        if not clip:
            raise FileNotFoundError("Trecho não encontrado")
        if clip.get("status") not in {"error", "cancelled"}:
            raise ValueError("A extração não precisa ser repetida")

        def mark_clip(item: dict[str, Any]) -> None:
            target = next(value for value in item.get("clips", []) if value.get("id") == clip_id)
            target["status"] = "extracting"
            target["status_detail"] = "Aguardando na fila de extração"
            target["progress"] = 0
            target["attempts"] = int(target.get("attempts") or 0) + 1
            target["error"] = ""

        payload = _mutate_manifest(video_dir, mark_clip)
        _spawn_task(f"clip:{video_id}:{clip_id}", _extract_clip, video_dir, clip_id)
    else:
        raise ValueError("Tarefa inválida")
    return _public_video(payload)


def _media_manifest(video_id: str, media_key: str) -> tuple[Path, dict[str, Any]]:
    _validate_video_id(video_id)
    if not media_key:
        raise FileNotFoundError("Chave de mídia ausente")
    storage = Path(settings.STORAGE_DIR).resolve()
    candidates: list[Path] = []
    cached_manifest = MEDIA_PATH_CACHE.get(video_id)
    if cached_manifest:
        candidates.append(cached_manifest.parent)
    candidates.append(storage / "forge_max_extractor" / "videos" / video_id)
    users_root = storage / "users"
    if users_root.exists():
        candidates.extend(users_root.glob(f"*/forge_max_extractor/videos/{video_id}"))
    for video_dir in candidates:
        try:
            payload = _read_manifest_from_dir(video_dir.resolve())
        except (FileNotFoundError, ValueError, OSError, json.JSONDecodeError):
            continue
        if secrets.compare_digest(str(payload.get("media_key") or ""), str(media_key)):
            MEDIA_PATH_CACHE[video_id] = _manifest_path(video_dir.resolve())
            return video_dir.resolve(), payload
    raise FileNotFoundError("Mídia não encontrada")


def source_file(video_id: str, media_key: str) -> Path:
    video_dir, payload = _media_manifest(video_id, media_key)
    path = Path(payload["source_path"]).resolve()
    if not path.exists() or path.parent.parent != video_dir:
        raise FileNotFoundError("Arquivo original não encontrado")
    return path


def proxy_file(video_id: str, media_key: str) -> Path:
    _video_dir_resolved, payload = _media_manifest(video_id, media_key)
    path = Path(payload["proxy_path"]).resolve()
    if not payload.get("proxy_ready") or not path.exists():
        return source_file(video_id, media_key)
    return path


def waveform_file(video_id: str, media_key: str) -> Path:
    _video_dir_resolved, payload = _media_manifest(video_id, media_key)
    path = Path(payload["waveform_path"]).resolve()
    if not payload.get("waveform_ready") or not path.exists():
        raise FileNotFoundError("Forma de onda ainda não disponível")
    return path


def _start_thumbnail_preparation(video_dir: Path, scenes: list[dict[str, Any]]) -> None:
    video_id = video_dir.name
    with THUMBNAIL_TASKS_GUARD:
        if video_id in THUMBNAIL_TASKS:
            return
        THUMBNAIL_TASKS.add(video_id)

    def runner() -> None:
        try:
            _prepare_scene_thumbnails(video_dir, scenes)
        finally:
            with THUMBNAIL_TASKS_GUARD:
                THUMBNAIL_TASKS.discard(video_id)

    threading.Thread(target=runner, daemon=True, name=f"forge-max-thumbnails-{video_id}").start()


def _prepare_scene_thumbnails(video_dir: Path, scenes: list[dict[str, Any]]) -> None:
    if not scenes:
        return
    try:
        import cv2

        cv2.setNumThreads(1)
        payload = _read_manifest_from_dir(video_dir)
        source = Path(payload["proxy_path"]) if payload.get("proxy_ready") else Path(payload["source_path"])
        target_dir = video_dir / "thumbnails"
        target_dir.mkdir(parents=True, exist_ok=True)

        def started(item: dict[str, Any]) -> None:
            item["thumbnail_status"] = "running"
            item["thumbnail_progress"] = 0

        _mutate_manifest(video_dir, started)
        with THUMBNAIL_SEMAPHORE:
            capture = cv2.VideoCapture(str(source))
            if not capture.isOpened():
                raise RuntimeError("Não foi possível abrir a prévia para gerar miniaturas")
            try:
                total = len(scenes)
                last_progress = -1
                for index, scene in enumerate(scenes, start=1):
                    moment = float(scene.get("start_seconds") or 0) + min(0.25, float(scene.get("duration") or 0) / 2)
                    bucket = int(max(0, moment) * 10)
                    path = target_dir / f"frame_{bucket:08d}.jpg"
                    if not path.exists():
                        capture.set(cv2.CAP_PROP_POS_MSEC, max(0, moment) * 1000)
                        ok, frame = capture.read()
                        if ok and frame is not None:
                            height, width = frame.shape[:2]
                            if width > 240:
                                next_height = max(2, round(height * (240 / width)))
                                frame = cv2.resize(frame, (240, next_height), interpolation=cv2.INTER_AREA)
                            cv2.imwrite(str(path), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
                    progress = round((index / total) * 100)
                    if progress == 100 or progress >= last_progress + 5:
                        _mutate_manifest(video_dir, lambda item, value=progress: item.update({"thumbnail_progress": value}))
                        last_progress = progress
            finally:
                capture.release()

        def complete(item: dict[str, Any]) -> None:
            item["thumbnail_status"] = "ready"
            item["thumbnail_progress"] = 100

        _mutate_manifest(video_dir, complete)
    except Exception as exc:
        try:
            _mutate_manifest(video_dir, lambda item: item.update({
                "thumbnail_status": "error",
                "thumbnail_error": str(exc),
            }))
        except Exception:
            pass


def thumbnail_file(video_id: str, seconds: float, media_key: str) -> Path:
    video_dir, payload = _media_manifest(video_id, media_key)
    duration = float(payload.get("duration") or 0)
    moment = max(0.0, min(float(seconds), max(0.0, duration - 0.05)))
    bucket = int(moment * 10)
    path = (video_dir / "thumbnails" / f"frame_{bucket:08d}.jpg").resolve()
    if path.exists():
        return path
    source = Path(payload["proxy_path"]) if payload.get("proxy_ready") else Path(payload["source_path"])
    with THUMBNAIL_SEMAPHORE:
        if path.exists():
            return path
        result = _run([
            settings.FFMPEG_BIN, "-y", "-hide_banner", "-loglevel", "error",
            "-ss", f"{moment:.3f}", "-i", str(source), "-frames:v", "1",
            "-vf", "scale=240:-2", "-q:v", "4", str(path),
        ], timeout=120)
        if result.returncode != 0 or not path.exists():
            raise _ffmpeg_error(result, "Falha ao gerar miniatura")
    return path


def clip_file(video_id: str, clip_id: str, media_key: str) -> tuple[Path, dict[str, Any]]:
    _validate_clip_id(clip_id)
    video_dir, payload = _media_manifest(video_id, media_key)
    clip = next((item for item in payload.get("clips", []) if item.get("id") == clip_id), None)
    if not clip or clip.get("status") != "ready":
        raise FileNotFoundError("Trecho ainda não está disponível")
    path = Path(clip["path"]).resolve()
    if not path.exists() or path.parent != (video_dir / "clips").resolve():
        raise FileNotFoundError("Arquivo do trecho não encontrado")
    return path, clip


def clips_archive_file(video_id: str, media_key: str) -> tuple[Path, str]:
    video_dir, payload = _media_manifest(video_id, media_key)
    clips = payload.get("clips", [])
    if not clips:
        raise ValueError("Extraia pelo menos uma cena antes de baixar o ZIP")

    processing = [item for item in clips if item.get("status") == "extracting"]
    failed = [item for item in clips if item.get("status") == "error"]
    if processing:
        raise ValueError(f"Aguarde {len(processing)} cena(s) terminar(em) a extração")
    if failed:
        raise ValueError(f"Existem {len(failed)} cena(s) com falha. Exclua ou extraia novamente antes do ZIP")

    clips_dir = (video_dir / "clips").resolve()
    ready_files: list[tuple[Path, str]] = []
    for index, clip in enumerate(clips, start=1):
        if clip.get("status") != "ready":
            raise ValueError("Todos os trechos precisam estar prontos antes do download")
        path = Path(clip.get("path") or "").resolve()
        if path.parent != clips_dir or not path.is_file() or path.stat().st_size <= 0:
            raise FileNotFoundError(f"Arquivo da cena {index} não foi encontrado")
        safe_name = re.sub(r"[^a-zA-Z0-9._-]+", "_", Path(clip.get("filename") or path.name).name)
        ready_files.append((path, f"cena_{index:03d}_{safe_name}"))

    export_dir = (video_dir / "exports").resolve()
    export_dir.mkdir(parents=True, exist_ok=True)
    archive_name = f"forge_max_cenas_{video_id[-8:]}.zip"
    archive_path = (export_dir / archive_name).resolve()
    if archive_path.is_file() and archive_path.stat().st_size > 0:
        newest_clip = max((path.stat().st_mtime for path, _name in ready_files), default=0)
        if archive_path.stat().st_mtime >= newest_clip:
            return archive_path, archive_name
    temp_path = archive_path.with_suffix(".zip.tmp")
    temp_path.unlink(missing_ok=True)

    with _video_lock(video_id):
        try:
            with zipfile.ZipFile(temp_path, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
                for path, archive_entry in ready_files:
                    archive.write(path, arcname=archive_entry)
            if not temp_path.is_file() or temp_path.stat().st_size <= 0:
                raise RuntimeError("O ZIP das cenas ficou vazio")
            temp_path.replace(archive_path)
        finally:
            temp_path.unlink(missing_ok=True)

    return archive_path, archive_name


def clips_archive_stream(video_id: str, media_key: str, clip_ids: list[str] | None = None):
    from services.forge_max.archive_service import archive_entries, stream_archive

    video_dir, payload = _media_manifest(video_id, media_key)
    entries = archive_entries(video_dir, payload, clip_ids)
    return stream_archive(entries), f"forge_max_cenas_{video_id[-8:]}.zip"


def health() -> dict[str, Any]:
    root = _videos_root()
    usage = shutil.disk_usage(root)
    return {
        "status": "operational",
        "module": "forge_max_scene_extractor",
        "max_duration_seconds": MAX_DURATION_SECONDS,
        "max_upload_mb": MAX_UPLOAD_MB,
        "max_scenes": MAX_SCENES,
        "free_storage_bytes": usage.free,
        "queue": {
            "active": bool(ACTIVE_TASK_KEY),
            "waiting": len(QUEUED_TASKS),
        },
        "features": {
            "resumable_upload": True,
            "scene_detection": "pyscenedetect_content_adaptive",
            "cancel_retry": True,
            "validated_mp4": True,
            "cached_thumbnails": True,
        },
    }
