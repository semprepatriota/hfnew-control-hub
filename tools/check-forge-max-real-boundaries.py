"""Compare the actual owner's scene edge frames against the untouched local original."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
from types import SimpleNamespace

import numpy as np

sys.path.insert(0,r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
from services.forge_max import extractor_service as extractor, scene_detector

root=Path(r'E:\HFNEW-FORGE-MAX-PRECISION')
audit_path=max(root.glob('*/audit.json'),key=lambda p:p.stat().st_mtime)
audit=json.loads(audit_path.read_text(encoding='utf-8'))
video=audit['videos'][0]
source=Path(r'E:\CANAL HFNEW - IMAGENS')/video['original_name']
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
rate,total=extractor._source_frame_timing(source)
assert rate and total
segments=[(scene['start_seconds'],scene['end_seconds']) for scene in video['scenes']]
windows=[extractor._frame_window(start,end,rate,total) for start,end in segments]
needed={round(start*float(rate)) for start,end,count in windows} | {round(end*float(rate))-1 for start,end,count in windows}
boundaries=[round(start*float(rate)) for start,end,count in windows[1:]]
needed |= {n for cut in boundaries for n in range(max(0,cut-9),min(total,cut+9))}
references={}
size=96*170*3
process=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-threads','1','-i',str(source),'-filter_threads','1',
    '-vf','scale=96:170:flags=area','-fps_mode','passthrough','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
try:
    index=0
    while raw:=process.stdout.read(size):
        if len(raw)!=size: raise RuntimeError('Incomplete original frame')
        if index in needed: references[index]=np.frombuffer(raw,dtype=np.uint8).reshape(170,96,3).copy()
        index+=1
    if process.wait(timeout=30)!=0: raise RuntimeError('Original decode failed')
finally:
    process.stdout.close()
    if process.poll() is None: process.kill();process.wait()
assert index==total and needed.issubset(references)
refinements=[]
for candidate in boundaries:
    history=[(SimpleNamespace(get_frames=lambda n=n:n),references[n]) for n in range(max(0,candidate-9),min(total,candidate+9))]
    refined=scene_detector.refine_hard_cut_frame(history,candidate)
    if refined!=candidate: refinements.append({'candidate':candidate/float(rate),'refined':refined/float(rate)})
segments=extractor._refine_scene_segments(segments,refinements)
windows=[extractor._frame_window(start,end,rate,total) for start,end in segments]
assert len(windows)==len(video['scenes'])
print('REAL_BOUNDARY_REFINEMENTS='+json.dumps(refinements),flush=True)
results=[]
with tempfile.TemporaryDirectory(prefix='real-clips-',dir=root) as directory:
    folder=Path(directory)
    clips=[]
    for index,(start,end) in enumerate(segments):
        clip_id='extract_'+f'{index:016x}'
        target=folder/'clips'/f'{index}.mp4'
        clips.append({'id':clip_id,'path':str(target),'filename':target.name,
            'start_seconds':start,'end_seconds':end,'status':'extracting'})
    extractor._write_manifest(folder,{'id':video['id'],'source_path':str(source),'duration':video['duration'],'clips':clips})
    for index,(clip,(start,end,count)) in enumerate(zip(clips,windows)):
        extractor._extract_clip(folder,clip['id'],task_key=f'clip:realprecision:{index}',cancel_event=threading.Event())
        saved=extractor._read_manifest_from_dir(folder)['clips'][index]
        if saved['status']!='ready': raise RuntimeError(saved)
        metadata=extractor.probe_media(Path(clip['path']))
        assert metadata.audio_codec=='aac'
        raw=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-threads','1','-i',clip['path'],'-filter_threads','1',
            '-vf',f'select=eq(n\\,0)+eq(n\\,{count-1}),scale=96:170:flags=area','-fps_mode','passthrough','-pix_fmt','rgb24','-f','rawvideo','pipe:1'])
        frames=np.frombuffer(raw,dtype=np.uint8).reshape(-1,170,96,3)
        assert len(frames)==2
        expected=[references[round(start*float(rate))],references[round(end*float(rate))-1]]
        errors=[float(np.abs(actual.astype(float)-reference.astype(float)).mean()) for actual,reference in zip(frames,expected)]
        if max(errors)>5: raise AssertionError(f'Scene {index+1} edge mismatch: {errors}')
        results.append({'scene':index+1,'expected_frames':count,'actual_frames':saved['frame_count'],'first_error':errors[0],'last_error':errors[1],'audio_codec':metadata.audio_codec})
        print(f'REAL_SCENE_{index+1}=OK | FRAMES={count} | EDGE_ERROR={max(errors):.3f}',flush=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
report={'source':str(source),'source_sha256':source_hash,'audited_live_extractor_sha256':audit['files']['services/forge_max/extractor_service.py']['sha256'],
    'remote_source':video['source_path'],'source_frames':total,'scene_count':len(results),'scenes':results,'refinements':refinements,'original_unchanged':True}
(root/'real-cut-precision-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(f'REAL_EDGE_FRAMES={len(results)*2}/{len(results)*2}_OK\nREAL_ORIGINAL=UNCHANGED')
