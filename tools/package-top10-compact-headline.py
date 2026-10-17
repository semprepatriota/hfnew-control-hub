"""Verify the exact small painter patch and build a source-only deploy archive."""
import hashlib
from pathlib import Path
import runpy
import tarfile

repo = Path(__file__).resolve().parents[1]
backend = Path(r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
deploy = repo / 'deploy/top10-headline-compact'
compact_source = runpy.run_path(str(deploy/'install.py'))['compact_source']
old = (repo/'deploy/top10/backend/services/top10_headline_service.py').read_text(encoding='utf-8')
current = (backend/'services/top10_headline_service.py').read_text(encoding='utf-8')
assert compact_source(old) == current, 'Patch changed unrelated code'
assert compact_source(current) == current, 'Patch must be idempotent'
folder = Path(r'E:\HFNEW-TOP10-TOOLS\compact-headline')
folder.mkdir(exist_ok=True)
archive = folder/'top10-compact-headline.tar.gz'
with tarfile.open(archive, 'w:gz') as output:
    output.add(deploy/'install.py', arcname='install.py')
    output.add(deploy/'test_top10_compact_headline.py', arcname='test_top10_compact_headline.py')
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(folder/'package-sha256.txt').write_text(digest, encoding='ascii')
print(f'PACKAGE={archive}\nPATCH_SCOPE=ONE_HEADLINE_PAINTER\nPACKAGE=OK')
