"""TOP 10 CTA: original Jesus Te Ama subscribe art, plus a matching thumbs-up."""
from math import floor
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / 'assets/top10/cta'


def timing(total_frames, fps=30):
    if not isinstance(total_frames, int) or total_frames < 1 or fps <= 0:
        raise ValueError('Invalid CTA duration')
    rnd = lambda value: floor(value + .5)
    seconds = total_frames / fps
    length = min(total_frames, max(1, rnd(min(3, max(.2, seconds-.1))*fps)))
    latest = max(0, total_frames-length-rnd(.1*fps))
    start = min(rnd(max(2.5, min(8, seconds*.22))*fps), latest)
    return dict(start=start, length=length, end=start+length, fade=max(1, min(rnd(.24*fps), length//4)))


def cta_overlay(input_index, label, segment_start, segment_frames, total_frames, fps=30):
    window = timing(total_frames, fps)
    low = max(segment_start, window['start'])
    high = min(segment_start+segment_frames, window['end'])
    if high <= low:
        return [], [], label
    button, like = ASSETS / 'subscribe-short-button.png', ASSETS / 'subscribe-short-like.png'
    if not button.is_file() or not like.is_file():
        raise RuntimeError('Recursos do CTA TOP 10 indisponiveis')
    inputs = []
    for asset in (button, like):
        inputs += ['-threads', '1', '-loop', '1', '-framerate', str(fps), '-i', str(asset)]
    start_frame = window['start']-segment_start
    start = start_frame/fps
    length = window['length']/fps
    fade = window['fade']/fps
    fade_out = max(0, (window['length']-1-window['fade'])/fps)
    rise_frames = min(floor(.3*fps+.5), max(1, floor(window['length']/3+.5)))
    rise_until = start + rise_frames/fps
    enable = f"between(t,{(low-segment_start)/fps:.9f},{(high-segment_start-1)/fps:.9f})"
    def source(index, width, height, name):
        return (f'[{index}:v]trim=duration={length:.9f},setpts=PTS-STARTPTS,scale={width}:{height}:flags=lanczos,'
                f'format=rgba,fade=t=in:start_frame=0:nb_frames={window["fade"]}:alpha=1,'
                f'fade=t=out:start_frame={max(0,window["length"]-1-window["fade"])}:nb_frames={window["fade"]}:alpha=1,'
                f'settb=1/{fps},setpts=PTS+({start_frame})[{name}]')
    # Even pixel coordinates prevent 4:2:0 chroma alignment from shifting small text.
    filters = [source(input_index, 360, 90, 'top10Subscribe'), source(input_index+1, 76, 86, 'top10Like'),
               f"[{label}][top10Subscribe]overlay=x=314:y='1362+floor(max(0,({rise_until:.9f}-t)*48)/2)*2':enable='{enable}':eof_action=pass:repeatlast=0:format=auto[withSubscribe]",
               f"[withSubscribe][top10Like]overlay=x=690:y=1366:enable='{enable}':eof_action=pass:repeatlast=0:format=auto[withCta]"]
    return inputs, filters, 'withCta'
