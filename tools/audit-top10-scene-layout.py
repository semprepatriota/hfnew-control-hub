"""Read only the owner's latest TOP 10 and emit compact, original-frame contact sheets."""
import base64
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

os.chdir('/root/ALLIANCE-DARK/backend')
sys.path.insert(0, '/root/ALLIANCE-DARK/backend')
from config import settings
from utils.user_context import set_current_user
from utils.workspace_storage import workspace_module_root
from services.render_coordinator import render_slot

set_current_user({'role':'owner','workspace_type':'internal','storage_scope':'legacy_owner'})
root = workspace_module_root('top10', create=False) / 'projects'
paths = sorted(root.glob('top10_*/project.json'), key=lambda p:p.stat().st_mtime, reverse=True)
if not paths:
    raise SystemExit('Nenhum projeto TOP 10 do proprietario foi encontrado.')
path = paths[0]
data = json.loads(path.read_text())
report = {'project_id':data['id'], 'title':data['title'], 'updated_at':data.get('updated_at'), 'scenes':[]}
with render_slot('top10_layout_audit', wait_timeout_seconds=15):
    for slot, scene in enumerate(data['config']['scenes']):
        asset = data['assets'].get(scene.get('asset_id'))
        if not asset: continue
        source = (path.parent / 'files' / asset['filename']).resolve()
        if source.parent != (path.parent / 'files').resolve() or not source.is_file():
            continue
        start,end=scene.get('start',0),scene.get('end') or asset['duration']
        zoom,x,y=scene.get('zoom',1),scene.get('x',.5),scene.get('y',.5)
        w,h=round(1080*zoom/2)*2,round(1920*zoom/2)*2
        frames=[]
        for index,fraction in enumerate((.03,.25,.5,.75,.97)):
            point=max(start,min(end-1/30,start+(end-start)*fraction))
            frame={'seconds':round(point,3)}
            try:
                with tempfile.TemporaryDirectory(prefix='top10-frame-audit-') as temporary:
                    target=Path(temporary)/'frame.jpg'
                    for rewind in (0,.25,.5):
                        actual=max(start,point-rewind)
                        result=subprocess.run([settings.FFMPEG_BIN,'-nostdin','-hide_banner','-loglevel','error','-y','-threads','1','-filter_threads','1',
                            '-ss',str(actual),'-i',str(source),'-vf',f'scale={w}:{h}:force_original_aspect_ratio=increase,crop=1080:1920:(in_w-1080)*{x}:(in_h-1920)*{y},scale=270:480',
                            '-frames:v','1','-c:v','mjpeg','-threads','1',str(target)],capture_output=True,check=True,timeout=30)
                        if target.is_file() and target.stat().st_size>0:
                            frame.update(seconds=round(actual,3),jpeg=base64.b64encode(target.read_bytes()).decode())
                            break
                    if 'jpeg' not in frame:
                        frame['error']='FFmpeg terminou sem produzir imagem; '+result.stderr.decode(errors='replace')[-300:]
            except (OSError,subprocess.SubprocessError) as exc:
                frame['error']=str(exc)
            frames.append(frame)
        report['scenes'].append({'rank':10-slot,'slot':slot,'name':asset.get('name'),'trim':[start,end],
            'headline':scene.get('headline'), 'frames':frames})
print('TOP10_LAYOUT_JSON='+json.dumps(report,ensure_ascii=True),flush=True)
print('TOP10_LAYOUT_AUDIT=OK',flush=True)
