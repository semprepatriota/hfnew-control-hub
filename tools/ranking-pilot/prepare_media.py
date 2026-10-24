import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path('E:/HFNEW-PILOTOS/ranking-multimidia')
PUBLIC = ROOT / 'public'
SOURCES = {
    'classic': Path('C:/Users/User/Downloads/Ranking Best Of Beach Moments (Pt.2).mp4'),
    'interludes': Path("C:/Users/User/Downloads/DON'T CHECK THE SOUND \U0001f62d.mp4"),
}
ASSETS = {}


def extract(asset_id, model, start, seconds, kind='scene'):
    directory = PUBLIC / 'media'
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / (asset_id + '.mp4')
    crop = 'crop=420:566:300:340,scale=720:972,setsar=1' if model == 'classic' else 'crop=380:594:340:260,scale=720:1122,setsar=1'
    subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-ss', str(start), '-i', str(SOURCES[model]),
        '-t', str(seconds), '-vf', crop + ',fps=30', '-map', '0:v:0', '-map', '0:a:0?',
        '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-ar', '48000', '-b:a', '160k', '-movflags', '+faststart', str(path)], check=True)
    metadata = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(path)]))
    video = next(s for s in metadata['streams'] if s['codec_type'] == 'video')
    poster = directory / (asset_id + '.jpg')
    subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-i', str(path), '-frames:v', '1', str(poster)], check=True)
    ASSETS[asset_id] = dict(id=asset_id, name=asset_id, src='/media/' + path.name, poster='/media/' + poster.name,
                           frames=int(video['nb_frames']), width=video['width'], height=video['height'], kind=kind)
    print('MEDIA=OK ' + asset_id, flush=True)
    return dict(assetId=asset_id, startFrame=0, endFrame=int(video['nb_frames']), volume=.8,
                x=.5, y=.5, zoom=1, fit='cover')


def main():
    presets = {}
    for model, starts, labels in [
        ('classic', [.6, 4.3, 10, 15, 20, 25], ['Entrada triunfal', 'A onda chegou', 'Plano de praia', 'Voo na areia', 'Surpresa noturna', 'Praia particular']),
        ('interludes', [2.8, 10, 17, 26.3, 32.9], ['A aranha', 'Hora do macarrão', 'Missão falhou', 'Treino diferente', 'Equilíbrio impossível'])
    ]:
        items = []
        for index, (start, label) in enumerate(zip(starts, labels)):
            seconds = 1.5 if model == 'interludes' and index == 4 else 2
            clip = extract(f'{model}-scene-{index+1}', model, start, seconds)
            interlude = None
            if model == 'interludes' and index < 4:
                interlude = extract(f'interlude-{index+1}', model, [7.1, 13.5, 23.2, 31.0][index], .8, 'interlude')
            items.append(dict(id=f'{model}-{index+1}', label=label, clips=[clip], interlude=interlude))
        outro = extract('outro', model, 35, .8, 'outro') if model == 'interludes' else None
        presets[model] = dict(version=1, id='pilot-' + model, model=model,
            titleLines=['Ranking Melhores', 'Momentos na Praia'] if model == 'classic' else ['Ranking Mais Engraçados', 'Momentos Inesperados'],
            highlights=['Melhores', 'Momentos'] if model == 'classic' else ['Engraçados', 'Momentos'],
            accent='#A27BFF' if model == 'classic' else '#FF4D79', titleSize=64, labelSize=38,
            items=items, music=None, outro=outro)
    fonts = PUBLIC / 'fonts'
    fonts.mkdir(exist_ok=True)
    font_source = ROOT / 'runtime/node_modules/@fontsource/montserrat/files/montserrat-latin-800-normal.woff2'
    shutil.copy2(font_source, fonts / font_source.name)
    shutil.copy2(ROOT / 'runtime/node_modules/@fontsource/montserrat/LICENSE', fonts / 'LICENSE-Montserrat.txt')
    data = ROOT / 'data'
    data.mkdir(exist_ok=True)
    (data / 'presets.json').write_text(json.dumps(dict(presets=presets, assets=ASSETS), ensure_ascii=False, indent=2), encoding='utf-8')
    print('PILOT_MEDIA=OK', flush=True)


if __name__ == '__main__':
    main()
