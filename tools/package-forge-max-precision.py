"""Package the exact audited Max change and local real-video evidence."""
import hashlib
import json
from pathlib import Path
import shutil
import tarfile

repo=Path(__file__).resolve().parent.parent
backend=Path(r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
release=repo/'deploy/forge-max-precision'
proof_root=Path(r'E:\HFNEW-FORGE-MAX-PRECISION')
proof=json.loads((proof_root/'real-cut-precision-report.json').read_text())
audit=json.loads(max(proof_root.glob('*/audit.json'),key=lambda p:p.stat().st_mtime).read_text())
assert proof['scene_count']==len(proof['scenes']) and proof['scene_count']>0 and proof['original_unchanged']
assert all(c['actual_frames']==c['expected_frames'] and max(c['first_error'],c['last_error'])<5 for c in proof['scenes'])
assert proof['audited_live_extractor_sha256']==audit['files']['services/forge_max/extractor_service.py']['sha256']
manifest={'baseline_sha256':proof['audited_live_extractor_sha256'],
    'detector_sha256':audit['files']['services/forge_max/scene_detector.py']['sha256'],
    'real_test':{key:proof[key] for key in ['source_sha256','remote_source','scene_count']},'files':{}}
for name in ['services/forge_max/extractor_service.py','services/forge_max/scene_detector.py','tests/test_forge_max_cut_precision.py']:
    target=release/'backend'/name;target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(backend/name,target)
    manifest['files'][name]=hashlib.sha256(target.read_bytes()).hexdigest()
(release/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
archive=proof_root/'forge-max-precision.tar.gz'
with tarfile.open(archive,'w:gz') as output:
    for name in ['install.py','manifest.json','backend']:
        output.add(release/name,arcname='forge-max-precision/'+name,filter=lambda entry:None if '__pycache__' in entry.name or entry.name.endswith('.pyc') else entry)
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
(proof_root/'package-sha256.txt').write_text(digest+'\n',encoding='ascii')
print('FORGE_MAX_PRECISION_PACKAGE='+str(archive)+'\nSHA256='+digest)
