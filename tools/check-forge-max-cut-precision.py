"""Reproduce neighboring-scene leakage with known non-keyframe boundaries."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading

import numpy as np

sys.path.insert(0,r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
from services.forge_max import extractor_service as extractor, scene_detector

output=Path(r'E:\HFNEW-FORGE-MAX-PRECISION')
output.mkdir(exist_ok=True)
reports=[]
with tempfile.TemporaryDirectory(prefix='precision-test-',dir=output) as temporary:
    root=Path(temporary)
    for fps,lengths in [(30,[32,34,28]),(60,[64,68,56]),(30000/1001,[32,34,28]),(30,[32,22,35])]:
        folder=root/f'{fps}-{lengths[1]}';folder.mkdir()
        source=folder/'source.mp4'
        frames=[np.full((90,160,3),colour,dtype=np.uint8) for colour,count in zip([(255,0,0),(0,0,255),(0,255,0)],lengths) for _ in range(count)]
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','160x90','-r',str(fps),'-i','pipe:0',
            '-an','-c:v','libx264','-crf','18','-threads','1','-g','300','-keyint_min','300','-sc_threshold','0','-pix_fmt','yuv420p',str(source)],input=b''.join(f.tobytes() for f in frames),check=True,timeout=30)
        duration=sum(lengths)/fps
        detected=scene_detector.detect(str(source),.30,duration)
        segments=extractor._refine_scene_segments(extractor._merge_boundaries(detected['boundaries'],duration),detected.get('boundary_refinements',[]))
        clips=[]
        for index,(start,end) in enumerate(segments):
            clip_id='extract_'+f'{index:016x}'
            clip_path=folder/'clips'/f'{index}.mp4'
            clips.append({'id':clip_id,'path':str(clip_path),'filename':clip_path.name,'start_seconds':start,'end_seconds':end,'status':'extracting'})
        extractor._write_manifest(folder,{'id':'extractor_'+'a'*16,'source_path':str(source),'duration':duration,'clips':clips})
        record={'fps':fps,'lengths':lengths,'boundaries':detected['boundaries'],'segments':segments,'clips':[]}
        for index,clip in enumerate(clips):
            extractor._extract_clip(folder,clip['id'],task_key=f'clip:precision:{index}',cancel_event=threading.Event())
            saved=next(c for c in extractor._read_manifest_from_dir(folder)['clips'] if c['id']==clip['id'])
            if saved['status']!='ready': raise RuntimeError(saved)
            raw=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-i',clip['path'],'-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'])
            decoded=np.frombuffer(raw,dtype=np.uint8).reshape(-1,3)
            colours=np.argmax(decoded,axis=1).tolist()
            expected=[0,2,1][index]
            result={'scene':index+1,'frames':len(colours),'first_colour':colours[0],'last_colour':colours[-1],
                    'foreign_frames':sum(colour!=expected for colour in colours)}
            record['clips'].append(result)
        reports.append(record)
        print(json.dumps(record),flush=True)
(output/'synthetic-precision-report.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
bad=sum(clip['foreign_frames'] for report in reports for clip in report['clips'])
print(f'FOREIGN_FRAMES={bad}')
if '--require-clean' in sys.argv and bad: raise SystemExit(1)
