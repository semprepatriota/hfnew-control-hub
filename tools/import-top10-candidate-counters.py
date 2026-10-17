"""Install visually mapped, complete counter sets without modifying existing models or originals."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

backend=Path(r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
repo=Path(__file__).resolve().parent.parent
root=backend/'assets/top10/counters'
download=Path(r'C:\Users\User\Downloads')
prefix='Dourado Simples Mensagem Motivacional V\u00eddeo para Reels do Instagram'
models={
    'comic_pop': {'label':'HQ Laranja','mapping':{10:5,9:6,8:7,7:8,6:9,5:10,4:12,3:13,2:14,1:15}},
    'aqua_badge': {'label':'Azul e Dourado','mapping':{10:18,9:19,8:20,7:24,6:23,5:25,4:26,3:28,2:27,1:29}},
    'space_blue': {'label':'Espacial Azul','mapping':{10:16,9:22,8:30,7:17,6:32,5:34,4:21,3:35,2:31,1:33}},
}
if len(sys.argv)>1:
    requested=set(sys.argv[1:])
    if not requested.issubset(models): raise SystemExit('Unknown candidate model')
    models={key:value for key,value in models.items() if key in requested}
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(path)]))['streams']

originals={str(p.relative_to(root)):digest(p) for p in root.glob('*/*.mp4') if p.parent.name not in models}
catalog=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
sources={}
provenance_path=root/'imported-candidates-provenance.json'
provenance=json.loads(provenance_path.read_text(encoding='utf-8')).get('models',{}) if provenance_path.is_file() else {}
with tempfile.TemporaryDirectory(prefix='normalize-',dir=r'E:\HFNEW-TOP10-TOOLS\new-counter-models') as temporary:
    staging=Path(temporary)
    for model,definition in models.items():
        metadata={'label':definition['label'],'frames':30,'frames_by_rank':{}}
        entries={}
        for rank in range(10,0,-1):
            number=definition['mapping'][rank]
            source=download/f'{prefix} ({number}).mp4'
            sources[source]=digest(source)
            video=next(s for s in probe(source) if s['codec_type']=='video')
            if video['r_frame_rate']!='30/1': raise RuntimeError('Unexpected source frame rate')
            frames=int(video['nb_frames'])
            duration=f'{frames/30:.9f}'
            target=staging/model/f'{rank:02d}.mp4'
            target.parent.mkdir(exist_ok=True)
            subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-threads','1','-i',str(source),
                '-filter_threads','1','-vf','setpts=PTS-STARTPTS,scale=1080:1920:flags=lanczos,setsar=1,fps=30',
                '-af',f'asetpts=PTS-STARTPTS,aresample=48000,apad,atrim=duration={duration}',
                '-map','0:v:0','-map','0:a:0','-frames:v',str(frames),'-t',duration,
                '-threads','2','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',
                '-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',str(target)],check=True,timeout=90)
            streams=probe(target)
            checked=next(s for s in streams if s['codec_type']=='video')
            assert int(checked['nb_frames'])==frames
            assert (checked['width'],checked['height'],checked['pix_fmt'])==(1080,1920,'yuv420p')
            assert any(s['codec_type']=='audio' and s['codec_name']=='aac' for s in streams)
            metadata['frames_by_rank'][str(rank)]=frames
            entries[str(rank)]={'source_file':source.name,'source_sha256':sources[source],
                                 'output_sha256':digest(target),'frames':frames}
            print(f'{model.upper()}_{rank}=OK | FRAMES={frames}',flush=True)
        catalog['models'][model]=metadata
        provenance[model]=entries
    assert all(digest(path)==sha for path,sha in sources.items())
    assert all(digest(root/path)==sha for path,sha in originals.items())
    for model in models:
        destination=root/model
        destination.mkdir(exist_ok=True)
        for path in (staging/model).glob('*.mp4'):
            shutil.copy2(path,destination/path.name)
catalog['revision']=hashlib.sha256(b''.join(p.read_bytes() for p in sorted(root.glob('*/*.mp4')))).hexdigest()[:16]
for target in [root/'manifest.json',repo/'src/modules/top10/counter-catalog.json']:
    target.write_text(json.dumps(catalog,indent=2)+'\n',encoding='utf-8')
provenance_path.write_text(json.dumps({
    'models':provenance,'omitted_duplicate':f'{prefix} (11).mp4',
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'NEW_COMPLETE_MODELS={len(models)}\nOLD_MODELS=UNCHANGED\nSOURCE_ORIGINALS=UNCHANGED')
