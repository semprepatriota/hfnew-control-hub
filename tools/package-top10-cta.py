import hashlib
import json
from pathlib import Path
import shutil
import tarfile

repo=Path(__file__).resolve().parents[1]
base=Path(r'E:\HFNEW-TOP10-TOOLS\headline-cta')
local=Path(r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
stage=base/'package'
names=['services/top10_service.py','services/top10_headline_service.py','services/top10_cta_service.py',
       'assets/top10/cta/subscribe-short-button.png','assets/top10/cta/subscribe-short-like.png']


def digest(path):
    data=path.read_text(encoding='utf-8').encode() if path.suffix=='.py' else path.read_bytes()
    return hashlib.sha256(data).hexdigest()


manifest={}
for name in names:
    source=local/name
    target=stage/'backend'/name
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,target)
    live=base/'live/backend'/name
    manifest[name]={'before':digest(live) if live.exists() else None,'after':digest(source)}
    if source.suffix=='.py':
        compile(source.read_text(encoding='utf-8'),name,'exec')
for name in ('install.py','test_top10_cta.py'):
    shutil.copy2(repo/'deploy/top10-cta'/name,stage/name)
(stage/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
# Keep the verified production sources under version control, not just on E:.
for name in names:
    target=repo/'deploy/top10-cta/backend'/name
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(local/name,target)
with tarfile.open(base/'top10-headline-cta.tar.gz','w:gz') as output:
    for name in [*('backend/'+name for name in names),'manifest.json','install.py','test_top10_cta.py']:
        output.add(stage/name,arcname=name)
print('TOP10_CTA_PACKAGE=OK')
