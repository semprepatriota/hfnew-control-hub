"""Animated logo validation and frame-aligned overlay shared by TOP 10 exports."""
from math import floor

from fastapi import HTTPException

LOGO_VIDEO_EXT = {'.mp4', '.webm'}


def validate_logo_video(media):
    if not 0 < media.duration <= 30:
        raise HTTPException(400, 'A logo animada deve ter ate 30 segundos')
    if not media.width or not media.height or max(media.width, media.height) > 2048:
        raise HTTPException(400, 'A logo animada aceita ate 2048 pixels por lado')
    if media.video_codec not in {'h264', 'vp8', 'vp9'}:
        raise HTTPException(400, 'Use logo MP4 H.264 ou WebM VP8/VP9')


def logo_overlay(asset, config, root, input_index, label, frame, fps, width, height):
    animated = bool(asset.get('animated'))
    inputs = ['-threads', '1']
    if animated:
        # Segments are rendered separately, but the logo keeps the global preview phase.
        offset = (frame / fps) % asset['duration']
        inputs += ['-stream_loop', '-1', '-ss', f'{offset:.6f}']
    else:
        inputs += ['-loop', '1']
    inputs += ['-i', str(root / 'files' / asset['filename'])]
    # Match JavaScript Math.round, including half-pixel placement.
    w = floor(width * config.logo_size + .5)
    h = floor(w * asset['height'] / asset['width'] + .5)
    x = min(max(0, floor(config.logo_x * width - w / 2 + .5)), max(0, width - w))
    y = min(max(0, floor(config.logo_y * height - h / 2 + .5)), max(0, height - h))
    filters = [
        f'[{input_index}:v]setpts=PTS-STARTPTS,fps={fps},scale={w}:{h},setsar=1,format=rgba,colorchannelmixer=aa={config.logo_opacity}[logo]',
        f'[{label}][logo]overlay={x}:{y}:format=auto[branded]',
    ]
    return inputs, filters
