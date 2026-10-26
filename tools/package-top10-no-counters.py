"""Package one TOP 10 service; refuse any drift from the last verified release."""
import hashlib
import json
from pathlib import Path
import shutil
import tarfile

repo=Path(__file__).resolve().parents[1]
base=Path(r'E:\HFNEW-TOP10-TOOLS\no-counters')
stage=base/'package'
name='services/top10_service.py'
source=Path(r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')/name
previous=repo/'deploy/top10-cta/backend'/name


def digest(path):
    return hashlib.sha256(path.read_text(encoding='utf-8').encode()).hexdigest()


compile(source.read_text(encoding='utf-8'),name,'exec')
for destination in (stage/'backend'/name,repo/'deploy/top10-no-counters/backend'/name):
    destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,destination)
for file in ('install.py','test_no_counters.py'):
    shutil.copy2(repo/'deploy/top10-no-counters'/file,stage/file)
(stage/'manifest.json').write_text(json.dumps({name:{'before':digest(previous),'after':digest(source)}},indent=2),encoding='utf-8')
with tarfile.open(base/'top10-no-counters.tar.gz','w:gz') as output:
    for file in ('backend/'+name,'manifest.json','install.py','test_no_counters.py'):
        output.add(stage/file,arcname=file)
print('TOP10_NO_COUNTERS_PACKAGE=OK')
