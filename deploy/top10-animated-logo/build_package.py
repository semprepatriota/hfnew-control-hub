"""Package exact, independently verified TOP 10 sources; preserve the source logo."""
import hashlib
import json
from pathlib import Path
import shutil
import tarfile

here = Path(__file__).resolve().parent
backend = Path(r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
baseline = here.parent / 'top10/backend'
destination = Path(r'E:\HFNEW-TOP10-TOOLS\animated-logo')
manifest = {}
for name in ['routes/top10.py', 'services/top10_service.py', 'services/top10_logo_service.py']:
    target = here / 'backend' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(backend / name, target)
    previous = baseline / name
    digest = lambda p: hashlib.sha256(p.read_text(encoding='utf-8').encode()).hexdigest()
    manifest[name] = {'before': digest(previous) if previous.exists() else None, 'after': digest(target)}
(here / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
archive = destination / 'top10-animated-logo.tar.gz'
with tarfile.open(archive, 'w:gz') as package:
    for name in ['install.py', 'manifest.json', 'test_logo.py', *('backend/' + n for n in manifest)]:
        package.add(here / name, arcname=name)
(destination / 'package-sha256.txt').write_text(hashlib.sha256(archive.read_bytes()).hexdigest(), encoding='ascii')
print(archive)
