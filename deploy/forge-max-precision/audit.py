"""Read active Max code and owner-only timing metadata without triggering any jobs."""
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

root=Path('/root/ALLIANCE-DARK/backend')
os.chdir(root)
sys.path.insert(0,str(root))
from config import settings
from utils.workspace_storage import workspace_module_root
from utils.user_context import set_current_user
set_current_user({'role':'owner','workspace_type':'internal','storage_scope':'legacy_owner'})
names=['services/forge_max/extractor_service.py','services/forge_max/scene_detector.py',
       'services/forge_max/archive_service.py','services/forge_max/AGENTS.md','routes/forge_max.py',
       'tests/test_forge_max_extractor.py','tests/test_forge_max_scene_motion_guard.py']
files={}
for name in names:
    path=root/name
    if path.is_file():
        content=path.read_bytes()
        files[name]={'sha256':hashlib.sha256(content).hexdigest(),'content':base64.b64encode(content).decode()}
videos=[]
folder=workspace_module_root('forge_max_extractor',create=False)/'videos'
manifests=sorted(folder.glob('extractor_*/video.json'),key=lambda path:path.stat().st_mtime,reverse=True)[:3]
for path in manifests:
    data=json.loads(path.read_text())
    video={key:data.get(key) for key in ['id','original_name','duration','status','analysis_status','scene_detection_engine','source_path','proxy_path','proxy_ready']}
    video['scenes']=[{key:scene.get(key) for key in ['id','start_seconds','end_seconds','duration']} for scene in data.get('scenes',[])]
    video['clips']=[{key:clip.get(key) for key in ['start_seconds','end_seconds','duration','status']} for clip in data.get('clips',[])][-15:]
    for label in ['source','proxy']:
        media=Path(data.get(label+'_path') or '/nonexistent')
        if media.is_file():
            result=subprocess.run([settings.FFPROBE_BIN,'-v','error','-show_entries','stream=codec_type,r_frame_rate,avg_frame_rate,time_base,start_time,duration,nb_frames:format=start_time,duration','-of','json',str(media)],capture_output=True,text=True,timeout=30)
            video[label+'_timing']=json.loads(result.stdout) if result.returncode==0 else {'error':result.stderr[-500:]}
    videos.append(video)
print('MAX_PRECISION_JSON='+json.dumps({'files':files,'videos':videos},ensure_ascii=True))
print('MAX_PRECISION_AUDIT=OK')
