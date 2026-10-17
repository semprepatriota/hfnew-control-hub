"""Isolated download fixture using an existing, valid TOP 10 smoke MP4."""
import os
import shutil
import sys

sys.path.insert(0, os.environ['TOP10_BACKEND_DIR'])
from config import settings
from services import top10_service as studio
from services.forge.ffmpeg_service import probe_media
from utils.user_context import set_current_user
from pathlib import Path

settings.STORAGE_DIR = os.environ['TOP10_PREVIEW_STORAGE']
settings.SECRET_KEY = 'local-top10-preview-separate-from-production'
set_current_user({'role': 'guest', 'workspace_type': 'personal', 'storage_scope': 'top10_local_preview', 'workspace_id': 'ws_top10_preview'})
project = studio.create_project('QA download MP4 - dados descartaveis')
source = Path(r'E:\HFNEW-TOP10-TOOLS\verification\top10-full-smoke.mp4')
target = studio.project_root(project['id']) / 'renders' / 'top10_download_test.mp4'
shutil.copyfile(source, target)
probe = probe_media(target)
data = studio.read_project(project['id'])
data['last_render'] = {'filename': target.name, 'duration': probe.duration, 'size': target.stat().st_size, 'width': probe.width, 'height': probe.height}
studio._write(data)
print('TOP10_DOWNLOAD_FIXTURE=OK')
