"""Verify the legacy auth upgrade and repeated installation without changing the real backend."""
import importlib.util
from pathlib import Path
import shutil
import tempfile

repo=Path(__file__).resolve().parent.parent
backend=Path(r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
spec=importlib.util.spec_from_file_location('top10_install_check',repo/'deploy/top10/install.py')
installer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
with tempfile.TemporaryDirectory(prefix='top10-integration-',dir=r'E:\HFNEW-TOP10-TOOLS') as directory:
    root=Path(directory)
    for name in installer.SHARED:
        target=root/name;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(backend/name,target)
    auth=root/'utils/request_auth.py'
    legacy=auth.read_text(encoding='utf-8').replace('counters/[a-z][a-z0-9_]{0,31}/','counters/(pink3d|film)/')
    auth.write_text(legacy,encoding='utf-8')
    first=installer.integrations(root)
    assert 'counters/[a-z][a-z0-9_]{0,31}/' in first['utils/request_auth.py']
    assert 'counters/(pink3d|film)/' not in first['utils/request_auth.py']
    for name,content in first.items(): (root/name).write_text(content,encoding='utf-8')
    assert installer.integrations(root)==first
    catalog=repo/'deploy/top10/backend/assets/top10/counters/manifest.json'
    assert catalog.is_file()
print('TOP10_LEGACY_MODEL_UPGRADE=OK\nTOP10_REPEAT_INSTALL=OK')
