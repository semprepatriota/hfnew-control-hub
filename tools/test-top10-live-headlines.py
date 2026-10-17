"""Two explicitly authorized paid checks using supplied videos and disposable E: projects."""
import argparse
import json
import os
from pathlib import Path
import sys
import tempfile
import uuid
from unittest.mock import patch

parser = argparse.ArgumentParser()
parser.add_argument('--allow-paid', action='store_true')
args = parser.parse_args()
if not args.allow_paid:
    raise SystemExit('Requires explicit --allow-paid; never part of automatic tests.')
sys.path.insert(0, r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
from config import settings
from services import top10_service as studio
from services import top10_headline_service as captions
from utils.user_context import set_current_user

set_current_user({'role': 'owner', 'workspace_type': 'internal', 'storage_scope': 'legacy_owner'})
central = captions.get_central_chatgpt_config()
if not central.get('enabled', True) or not central.get('api_key'):
    raise SystemExit('ChatGPT key is not configured. No paid calls executed.')
output = Path(r'E:\HFNEW-TOP10-TOOLS\headline-verification').resolve()
output.mkdir(exist_ok=True, parents=True)
sources = [
    ('translation', Path(r'E:\CANAL HFNEW - IMAGENS\user7732323633021 - 7696824576080219423.mp4'), 1, 4),
    ('new_headline', Path(r'E:\CANAL HFNEW - IMAGENS\ssstik.io_@fluffelvideos_1792192103530.mp4'), 35, 38),
]
results = []
old_storage = settings.STORAGE_DIR
try:
    with tempfile.TemporaryDirectory(prefix='live-caption-', dir=output) as temporary:
        assert Path(temporary).resolve().is_relative_to(output)
        settings.STORAGE_DIR = temporary
        # Keep the existing credentials in memory; changing the temporary media root must
        # not change the credential source. HTTP/OpenAI calls themselves are NOT mocked.
        with patch.object(captions, 'get_central_chatgpt_config', return_value=central):
            for label, source, start, end in sources:
                print('START=' + label, flush=True)
                metadata = studio.probe_media(source)
                project = studio.create_project('Explicit live test ' + label)
                data = studio.read_project(project['id'])
                target = studio.project_root(project['id']) / 'files/source.mp4'
                os.link(source, target)
                data['assets']['source'] = {'id':'source', 'kind':'video', 'filename':target.name,
                    'duration':metadata.duration, 'has_audio':bool(metadata.audio_codec)}
                data['config']['scenes'][0].update(asset_id='source', start=start, end=end)
                data = studio._write(data)
                result = captions.generate_headline(project['id'], 0, data['revision'], 'source', uuid.uuid4().hex)
                results.append({'test':label, 'model':central.get('model'), 'source':source.name,
                                'trim':[start,end], **result})
                (output / 'live-headline-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
                print(json.dumps(results[-1], ensure_ascii=False), flush=True)
                print('PASSED=' + label, flush=True)
finally:
    settings.STORAGE_DIR = old_storage
print('LIVE_TRANSLATION_AND_HEADLINE=OK')
