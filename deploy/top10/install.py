"""Add TOP 10 to the live backend using additive, rollback-capable changes."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

SHARED = ["main.py", "services/access_policy.py", "utils/request_auth.py", "services/billing_store.py", "services/admin_store.py"]
PROTECTED = ["routes/forge.py", "routes/forge2.py", "routes/forge_5050.py", "routes/forge_max.py", "services/render_coordinator.py", "services/forge_render_queue.py"]


def insert(text, marker, addition, identity, before=True):
    if identity in text:
        return text
    if text.count(marker) != 1:
        raise RuntimeError(f"Integracao ambigua: {identity}")
    return text.replace(marker, addition + marker if before else marker + addition, 1)


def integrations(root):
    changes = {}
    text = (root / "main.py").read_text(encoding="utf-8-sig")
    text = insert(text, "app.include_router(forge_5050.router)", "\nfrom routes import top10\napp.include_router(top10.router)", "app.include_router(top10.router)", False)
    text = insert(text, '"forge5050": True,', '"top10": True,\n            ', '"top10": True,')
    changes["main.py"] = text
    text = (root / "services/access_policy.py").read_text(encoding="utf-8-sig")
    text = insert(text, '    {"key": "forge_7030",', '    {"key": "top10", "label": "TOP 10", "frontend_path": "/top-10", "customer_visible": True},\n', '"key": "top10"')
    text = insert(text, '    ("/api/forge5050", "forge_5050"),', '    ("/api/top10", "top10"),\n', '("/api/top10", "top10")')
    changes["services/access_policy.py"] = text
    text = (root / "utils/request_auth.py").read_text(encoding="utf-8-sig")
    if not re.search(r"^import re$", text, re.M):
        text = insert(text, "from typing import Optional", "\nimport re", "import re", False)
    old_counter_models = 'counters/(pink3d|film)/'
    counter_models = 'counters/[a-z][a-z0-9_]{0,31}/'
    if old_counter_models in text:
        if text.count(old_counter_models) != 1:
            raise RuntimeError('Integracao ambigua dos contadores TOP 10')
        text = text.replace(old_counter_models, counter_models, 1)
    text = insert(text, '    if normalized_path.startswith(LEGACY_PUBLIC_MEDIA_PREFIXES):', '    if re.fullmatch(r"/api/top10/(media/top10_[a-f0-9]{24}/[A-Za-z0-9_.-]+|counters/[a-z][a-z0-9_]{0,31}/[0-9]+\\.mp4)", normalized_path):\n        return normalized_method in {"GET", "HEAD"}\n', 'r"/api/top10/(media/')
    changes["utils/request_auth.py"] = text
    text = (root / "services/billing_store.py").read_text(encoding="utf-8-sig")
    text = insert(text, "    patterns = (\n", '        (r"^/api/top10/projects/[^/]+/exports$", "render_jobs"),\n', 'r"^/api/top10/projects/', False)
    changes["services/billing_store.py"] = text
    text = (root / "services/admin_store.py").read_text(encoding="utf-8-sig")
    text = insert(text, "    prefixes = (\n", '        ("/api/top10", "top10"),\n', '("/api/top10", "top10")', False)
    changes["services/admin_store.py"] = text
    for name, content in changes.items():
        compile(content, name, "exec")
    return changes


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def http(path, headers=None):
    request = urllib.request.Request("http://127.0.0.1:9000" + path, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def wait_healthy():
    for _ in range(30):
        try:
            code, body = http("/api/status")
            if code == 200:
                return json.loads(body)
        except (OSError, ValueError):
            pass
        time.sleep(1)
    raise RuntimeError("A API nao voltou a responder apos o reinicio")


def install(root, package):
    root = root.resolve()
    if root != Path("/root/ALLIANCE-DARK/backend"):
        raise RuntimeError("Raiz de producao inesperada")
    additions = package / "backend"
    manifest = json.loads((package / "manifest.json").read_text(encoding="utf-8"))
    for relative, expected in manifest.items():
        path = (additions / relative).resolve()
        if not path.is_relative_to(additions.resolve()) or digest(path) != expected:
            raise RuntimeError(f"Pacote invalido: {relative}")
    counter_root = additions / 'assets/top10/counters'
    counter_models = json.loads((counter_root / 'manifest.json').read_text())['models']
    if not counter_models or any(not re.fullmatch(r'[a-z][a-z0-9_]{0,31}', model) for model in counter_models):
        raise RuntimeError('Catalogo de modelos TOP 10 invalido')
    expected_counters = {f'{model}/{rank:02d}.mp4' for model in counter_models for rank in range(1,11)}
    actual_counters = {path.relative_to(counter_root).as_posix() for path in counter_root.glob('*/*.mp4')}
    if actual_counters != expected_counters:
        raise RuntimeError('Cada modelo do pacote precisa ter os dez contadores de 10 a 1')
    memory = dict(line.split(":", 1) for line in Path("/proc/meminfo").read_text().splitlines())
    available_kb = int(memory["MemAvailable"].split()[0])
    if available_kb < 512 * 1024:
        raise RuntimeError("Memoria disponivel abaixo de 512 MB. Nada foi aplicado; aguarde a producao terminar.")
    if shutil.disk_usage(root).free < 256 * 1024 * 1024:
        raise RuntimeError("Espaco livre abaixo da reserva de 256 MB. Nada foi aplicado.")
    changes = integrations(root)
    protected = {name: digest(root / name) for name in PROTECTED if (root / name).is_file()}

    # The same distributed lock is used by the Forge workers. Existing work finishes first.
    from redis import Redis
    redis = Redis.from_url(os.getenv("HFNEW_REDIS_URL", "redis://127.0.0.1:6379/0"), socket_timeout=3)
    redis.ping()
    capacity = redis.lock("hfnew:render:capacity", timeout=600)
    print("Aguardando capacidade de render livre...", flush=True)
    if not capacity.acquire(blocking=True, blocking_timeout=30):
        raise RuntimeError("Ha render em producao. Nada foi aplicado; tente apos concluir.")
    backup = Path("/root") / ("hfnew-top10-backup-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"))
    originals = {}
    restarted = False
    try:
        if subprocess.run(["pgrep", "-x", "ffmpeg"], capture_output=True).returncode == 0:
            raise RuntimeError("FFmpeg em uso. Instalacao preservada para nao interromper a producao.")
        for relative in [*SHARED, *manifest]:
            path = root / relative
            originals[relative] = path.exists()
            if path.exists():
                target = backup / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, target)
        for relative in manifest:
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(additions / relative, target)
        for relative, content in changes.items():
            (root / relative).write_text(content, encoding="utf-8")
        for relative in [*SHARED, "routes/top10.py", "services/top10_service.py"]:
            compile((root / relative).read_text(encoding="utf-8"), relative, "exec")
        environment = {**os.environ, "PYTHONPATH": str(root), "TOP10_SKIP_MEDIA_TEST": "1"}
        subprocess.run([str(root / "venv/bin/python"), str(root / "tests/test_top10.py"), "-v"], cwd=root, env=environment, check=True, timeout=300)
        if any(digest(root / name) != original for name, original in protected.items()):
            raise RuntimeError("Arquivo Forge alterado durante a instalacao")
        if subprocess.run(["pgrep", "-x", "ffmpeg"], capture_output=True).returncode == 0:
            raise RuntimeError("Um processamento iniciou. A instalacao sera revertida antes de reiniciar a API.")
        subprocess.run(["systemctl", "restart", "hfnew-api"], check=True)
        restarted = True
        status = wait_healthy()
        if not status.get("modules", {}).get("top10"):
            raise RuntimeError("TOP 10 nao registrado na API")
        if http("/api/top10/projects")[0] != 401:
            raise RuntimeError("Falha na protecao de autenticacao")
        models = json.loads((root / 'assets/top10/counters/manifest.json').read_text())['models']
        for model in models:
            if http(f"/api/top10/counters/{model}/10.mp4", {"Range": "bytes=0-63"})[0] != 206:
                raise RuntimeError(f"Falha na leitura parcial do contador: {model}")
        print("API_HEALTH=OK\nAUTH_PROTECTION=OK\nCOUNTER_RANGE=OK\nFORGE_FILES=UNCHANGED\nTOP10_BACKEND=OK", flush=True)
        print(f"BACKUP={backup}", flush=True)
    except Exception:
        for relative, existed in originals.items():
            target = root / relative
            if existed:
                shutil.copy2(backup / relative, target)
            else:
                target.unlink(missing_ok=True)
        if restarted:
            subprocess.run(["systemctl", "restart", "hfnew-api"], check=False)
            wait_healthy()
        print(f"ROLLBACK=concluido\nBACKUP={backup}", flush=True)
        raise
    finally:
        try:
            capacity.release()
        except Exception:
            pass


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        integrations(Path(sys.argv[2]))
        print("TOP10_INTEGRATION_CHECK=OK")
    else:
        install(Path("/root/ALLIANCE-DARK/backend"), Path(__file__).resolve().parent)
