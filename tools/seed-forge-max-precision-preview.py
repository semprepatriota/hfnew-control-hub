"""Disposable portrait fixture for previewing exact scene ends in the browser."""
from pathlib import Path
import sys
import subprocess
import numpy as np

sys.path.insert(0,r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
from config import settings
from services.forge_max import extractor_service as extractor
from utils.user_context import set_current_user
from utils.workspace_storage import workspace_module_root

settings.STORAGE_DIR=r'E:\HFNEW-TOP10-TOOLS\bridge-preview'
set_current_user({'role':'guest','workspace_type':'personal','storage_scope':'top10_local_preview','workspace_id':'ws_top10_preview'})
video_id='extractor_'+'d'*16
root=workspace_module_root('forge_max_extractor')/'videos'/video_id
for folder in ['source','proxy','clips','thumbnails']:
    (root/folder).mkdir(parents=True,exist_ok=True)
source=root/'source/original.mp4'
frames=[np.full((160,90,3),colour,dtype=np.uint8).tobytes() for colour,count in zip([(255,0,0),(0,0,255),(0,255,0)],[32,34,28]) for _ in range(count)]
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','90x160','-r','30','-i','pipe:0',
    '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3.133333','-c:v','libx264','-threads','1','-g','300','-sc_threshold','0',
    '-pix_fmt','yuv420p','-c:a','aac','-shortest',str(source)],input=b''.join(frames),check=True,timeout=30)
extractor._write_manifest(root,{'id':video_id,'original_name':'QA - corte preciso 30 FPS.mp4','source_path':str(source),
    'proxy_path':str(root/'proxy/preview.mp4'),'frame_rate':30,'duration':94/30,'width':90,'height':160,
    'media_key':'local-only-precision-preview-12345678','status':'ready','analysis_status':'ready','proxy_ready':False,
    'created_at':'2026-10-17T16:40:00Z','updated_at':'2026-10-17T16:40:00Z','clips':[],'scenes':[
        {'id':f'scene_{index+1:04d}','index':index+1,'label':f'Cena {index+1}','start_seconds':start,'end_seconds':end,'duration':end-start}
        for index,(start,end) in enumerate([(0,32/30),(32/30,66/30),(66/30,94/30)])]})
print('PRECISION_PREVIEW_FIXTURE=OK')
