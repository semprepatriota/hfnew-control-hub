"""Build and verify the explicit Chrome extension payload, without repo/private files."""
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
root = repo / 'extension' / 'hf-bulk-explorer'
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
files = {'manifest.json', 'background.js', 'carousel.js', 'content-status.js', 'popup.js', 'popup.html', 'popup.css', 'README.md', *manifest['icons'].values()}
assert manifest['host_permissions'] == ['https://app.hfnew.com.br/*', 'https://www.instagram.com/*']
assert manifest['permissions'] == ['activeTab', 'scripting', 'storage']
for content in manifest['content_scripts']:
    assert set(content['js']).issubset(files)
assert all((root / name).is_file() for name in files)
folder = Path(r'E:\HFNEW-EXTENSAO')
folder.mkdir(parents=True, exist_ok=True)
archive = folder / f"HF-Bulk-Explorer-{manifest['version']}.zip"
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as output:
    for name in sorted(files):
        output.write(root / name, name)
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None
    assert set(output.namelist()) == files
    assert json.loads(output.read('manifest.json'))['version'] == manifest['version']
    for name in files:
        assert output.read(name) == (root / name).read_bytes()
public = repo / 'public' / 'downloads' / 'hf-bulk-explorer.zip'
shutil.copyfile(archive, public)
print(f'EXTENSION_VERSION={manifest["version"]}')
print(f'ZIP={archive}')
print(f'ZIP_BYTES={archive.stat().st_size}')
print(f'SHA256={hashlib.sha256(archive.read_bytes()).hexdigest()}')
print('EXTENSION_PACKAGE=OK')
