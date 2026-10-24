"""Read only the active TOP 10 sources and the reusable Jesus Te Ama CTA assets."""
import base64
import hashlib
import json
from pathlib import Path

backend = Path('/root/ALLIANCE-DARK/backend')
files = {}
for name in ('services/top10_service.py', 'services/top10_headline_service.py', 'services/top10_logo_service.py', 'routes/top10.py'):
    path = backend / name
    value = path.read_bytes()
    files['backend/' + name] = dict(data=base64.b64encode(value).decode(), sha256=hashlib.sha256(value).hexdigest())
jesus = Path('/opt/hfnew-jesus-te-ama/current').resolve()
names = []
if jesus.is_dir():
    asset_dir = jesus / 'assets/branding'
    names = sorted(p.name for p in asset_dir.iterdir()) if asset_dir.is_dir() else []
    selected = [jesus / 'lib/subscribe-prompt.mjs']
    selected += [p for p in asset_dir.glob('*.png') if any(word in p.name.lower() for word in ('subscribe', 'like', 'thumb', 'joinha', 'curt'))]
    for path in selected:
        if path.is_file() and path.stat().st_size <= 2 * 1024**2:
            value = path.read_bytes()
            files['jesus/' + path.relative_to(jesus).as_posix()] = dict(data=base64.b64encode(value).decode(), sha256=hashlib.sha256(value).hexdigest())
print('TOP10_CTA_AUDIT_JSON=' + json.dumps(dict(files=files, jesus_release=str(jesus), jesus_assets=names)))
