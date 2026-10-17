"""Create a small disposable vertical source for the loopback bridge preview."""
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, os.environ['TOP10_BACKEND_DIR'])
from config import settings
from services import top10_service as studio
from utils.user_context import set_current_user
from utils.workspace_storage import workspace_module_root, write_json_atomic

settings.STORAGE_DIR = os.environ['TOP10_PREVIEW_STORAGE']
set_current_user({'role': 'guest', 'workspace_type': 'personal', 'storage_scope': 'top10_local_preview', 'workspace_id': 'ws_top10_preview'})
video_id = 'extractor_' + 'c' * 16
root = workspace_module_root('forge_max_extractor') / 'videos' / video_id
(root / 'clips').mkdir(parents=True, exist_ok=True)
(root / 'source').mkdir(exist_ok=True)
source = root / 'source/original.mp4'
shutil.copy2(studio.counter_path('pink3d', 3), source)
clips = []
for rank in [2, 1]:
    clip_id = 'extract_' + str(rank) * 16
    path = root / 'clips' / f'cena_{rank}.mp4'
    shutil.copy2(studio.counter_path('pink3d', rank), path)
    clips.append({'id': clip_id, 'filename': path.name, 'path': str(path), 'status': 'ready', 'title': f'Cena {rank}', 'start_seconds': 0, 'end_seconds': 1, 'duration': 1})
write_json_atomic(root / 'video.json', {
    'id': video_id, 'original_name': 'QA vertical.mp4', 'source_path': str(source),
    'media_key': 'local-bridge-preview-media-key', 'status': 'ready', 'analysis_status': 'completed',
    'proxy_ready': False, 'waveform_ready': False, 'duration': 29/30,
    'width': 1080, 'height': 1920, 'size': source.stat().st_size,
    'created_at': '2026-10-17T12:00:00+00:00', 'scenes': [], 'clips': clips,
})
print('LOCAL_VERTICAL_FIXTURE=OK')
