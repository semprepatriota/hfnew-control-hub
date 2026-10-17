"""Collect the dedicated backend and counters into a verifiable release."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tarfile

repo = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]).resolve()
release = repo / "deploy/top10"
targets = ["routes/top10.py", "services/top10_service.py", "services/top10_forge_max_bridge.py", "tests/test_top10.py"]
targets += [str(path.relative_to(source)).replace("\\", "/") for path in (source / "assets/top10/counters").rglob("*") if path.is_file()]
manifest = {}
for relative in targets:
    target = release / "backend" / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source / relative, target)
    manifest[relative] = hashlib.sha256(target.read_bytes()).hexdigest()
(release / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
archive = Path(sys.argv[2]).resolve()
with tarfile.open(archive, "w:gz") as output:
    output.add(release, arcname="top10", filter=lambda entry: None if entry.name.endswith((".log", ".pyc")) or "/__pycache__" in entry.name else entry)
print(f"TOP10_PACKAGE={archive}\nCOUNTERS={len([key for key in manifest if key.endswith('.mp4')])}")
