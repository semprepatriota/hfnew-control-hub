"""Read only the newly supplied counter candidates; preserve every source file."""
import json
from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw

source = Path(r'C:\Users\User\Downloads')
output = Path(r'E:\HFNEW-TOP10-TOOLS\new-counter-models')
output.mkdir(parents=True, exist_ok=True)
prefix = 'Dourado Simples Mensagem Motivacional V\u00eddeo para Reels do Instagram'
records = []
sheets = [Image.new('RGB', (1440, 6*450), '#151515') for _ in range(3)]
for index, number in enumerate(range(5, 36)):
    path = source / f'{prefix} ({number}).mp4'
    record = {'source_number': number, 'path': str(path), 'exists': path.is_file()}
    if path.is_file():
        metadata = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)]))
        video = next(s for s in metadata['streams'] if s['codec_type']=='video')
        duration = float(metadata['format']['duration'])
        record.update(duration=duration, size=path.stat().st_size, width=video['width'], height=video['height'],
                      fps=video['r_frame_rate'], audio=any(s['codec_type']=='audio' for s in metadata['streams']))
        for sample, fraction in enumerate((.2,.5,.8)):
            frame=output/f'candidate-{number:02d}-{sample}.jpg'
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-threads','1','-ss',str(duration*fraction),'-i',str(path),
                            '-vf','scale=240:400:force_original_aspect_ratio=decrease,pad=240:400:(ow-iw)/2:(oh-ih)/2',
                            '-frames:v','1',str(frame)],check=True,capture_output=True,timeout=20)
            x,y=(index%6)*240,(index//6)*450
            with Image.open(frame) as image:
                sheets[sample].paste(image,(x,y+42))
            ImageDraw.Draw(sheets[sample]).text((x+5,y+7),f'Arquivo {number} | {duration:.2f}s',fill='white')
    records.append(record)
    print(f'FILE_{number}=' + ('OK' if record['exists'] else 'MISSING'),flush=True)
for sample, sheet in enumerate(sheets):
    sheet.save(output/f'candidate-contact-{sample}.jpg',quality=94)
(output/'candidate-audit.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print('COUNTER_CANDIDATE_AUDIT=OK')
