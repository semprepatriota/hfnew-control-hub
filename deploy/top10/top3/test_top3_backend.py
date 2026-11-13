import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException
from PIL import Image
from config import settings
from services import top10_service as studio
from utils.user_context import reset_current_user, set_current_user
from utils.workspace_storage import write_json_atomic


class Top3BackendTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.storage = settings.STORAGE_DIR
        self.secret = settings.SECRET_KEY
        settings.STORAGE_DIR = str(Path(self.temp.name) / 'storage')
        settings.SECRET_KEY = 'top3-test-secret-at-least-thirty-two-characters'
        self.token = set_current_user({
            'role': 'guest', 'workspace_type': 'personal', 'storage_scope': 'test_top3',
            'workspace_id': 'ws_top3',
        })
        self.project = studio.create_project('Top 3 test')
        self.root = studio.project_root(self.project['id'])

    def tearDown(self):
        reset_current_user(self.token)
        settings.STORAGE_DIR = self.storage
        settings.SECRET_KEY = self.secret
        self.temp.cleanup()

    def video(self, name, color, seconds=1):
        path = self.root / 'files' / name
        subprocess.run([
            settings.FFMPEG_BIN, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
            '-f', 'lavfi', '-i', f'color=c={color}:s=270x480:r=30:d={seconds}',
            '-f', 'lavfi', '-i', f'sine=frequency=440:duration={seconds}',
            '-c:v', 'libx264', '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
            '-shortest', str(path),
        ], check=True)
        return path

    def build(self):
        for slot, color in ((7, 'red'), (8, 'green'), (9, 'blue')):
            self.project = studio.add_asset(self.project['id'], self.video(f'asset_scene{slot}.mp4', color),
                                            'video', f'scene{slot}.mp4', slot)
        image = self.root / 'files' / 'asset_extra7.png'
        Image.new('RGB', (270, 480), 'yellow').save(image)
        self.project = studio.add_asset(self.project['id'], image, 'insert', 'extra7.png', 7)
        self.project = studio.add_asset(self.project['id'], self.video('asset_extra8.mp4', 'magenta', .8),
                                        'insert', 'extra8.mp4', 8)
        final = self.root / 'files' / 'asset_extra9.png'
        Image.new('RGB', (270, 480), 'cyan').save(final)
        self.project = studio.add_asset(self.project['id'], final, 'insert', 'extra9.png', 9)
        config = studio.Top10Config(**self.project['config'])
        config.format = 'top3'
        config.counters_enabled = False
        config.inserts[0].duration = 1.5
        config.inserts[1].duration = 2
        config.inserts[2].duration = 3
        self.project = studio.save_project(self.project['id'], 'Top 3 test', config, self.project['revision'])
        return studio.read_project(self.project['id'])

    def test_timeline_and_optional_extras(self):
        data = self.build()
        items = studio.timeline(data)
        self.assertEqual([item['kind'] for item in items], ['scene', 'insert', 'scene', 'insert', 'scene', 'insert'])
        self.assertEqual([item['rank'] for item in items if item['kind'] == 'scene'], [3, 2, 1])
        self.assertEqual([item['frames'] for item in items], [30, 45, 30, 60, 30, 90])
        for previous, current in zip(items, items[1:]):
            self.assertEqual(previous['from'] + previous['frames'], current['from'])
        data['config']['inserts'][0]['asset_id'] = ''
        self.assertEqual(len(studio.timeline(data)), 5)
        data['config']['scenes'][8]['asset_id'] = ''
        self.assertEqual([item['rank'] for item in studio.timeline(data) if item['kind'] == 'scene'], [3, 1])
        self.assertEqual(len(studio.timeline(data)), 3)

    def test_invalid_extra_is_rejected_without_affecting_scenes(self):
        data = self.build()
        config = studio.Top10Config(**data['config'])
        config.inserts[1].start = .79
        config.inserts[1].duration = 2
        with self.assertRaises(HTTPException):
            studio.save_project(data['id'], 'Top 3 test', config, data['revision'])
        self.assertEqual([item['kind'] for item in studio.timeline(studio.read_project(data['id']))],
                         ['scene', 'insert', 'scene', 'insert', 'scene', 'insert'])

    def test_existing_two_extra_project_accepts_final_extra(self):
        data = studio.read_project(self.project['id'])
        data['config']['inserts'] = data['config']['inserts'][:2]
        data['config']['inserts'][0]['duration'] = .5
        studio._write(data)
        self.assertEqual(len(studio.public_project(data)['config']['inserts']), 3)
        self.assertEqual(studio.public_project(data)['config']['inserts'][0]['duration'], 1.5)
        self.assertEqual(studio.public_project(data)['config']['inserts'][2]['duration'], 2)
        final = self.root / 'files' / 'asset_final.png'
        Image.new('RGB', (270, 480), 'cyan').save(final)
        result = studio.add_asset(data['id'], final, 'insert', 'final.png', 9)
        self.assertEqual(len(result['config']['inserts']), 3)
        self.assertEqual(result['config']['inserts'][2]['asset_id'], final.stem)

    def test_mp4_renders_three_scenes_and_three_extras(self):
        data = self.build()
        job_id = 'job_' + '1' * 24
        job_path = self.root / 'jobs' / f'{job_id}.json'
        write_json_atomic(job_path, {'id': job_id, 'status': 'running', 'progress': 0})
        result = studio.render_project(data, job_path)
        video = self.root / 'renders' / result['filename']
        self.assertTrue(video.is_file())
        probe = studio.probe_media(video)
        self.assertEqual((probe.width, probe.height, probe.video_codec), (1080, 1920, 'h264'))
        self.assertAlmostEqual(probe.duration, 9.5, delta=.3)
        for at, dominant in ((.2, 0), (1.2, 0), (2.7, 1), (4.2, 0), (5.2, 0), (5.7, 2), (7.2, 1)):
            frame = self.root / f'frame_{at}.png'
            subprocess.run([settings.FFMPEG_BIN, '-nostdin', '-hide_banner', '-loglevel', 'error',
                            '-ss', str(at), '-i', str(video), '-frames:v', '1', '-y', str(frame)], check=True)
            with Image.open(frame) as image:
                rgb = image.convert('RGB').getpixel((540, 300))
                self.assertGreater(rgb[dominant], 100, (at, rgb))

    def test_mp4_renders_single_scene_extra_logo_and_music(self):
        data = self.build()
        logo = self.root / 'files' / 'asset_logo.png'
        Image.new('RGB', (200, 200), 'white').save(logo)
        data = studio.add_asset(data['id'], logo, 'logo', 'logo.png', None)
        music = self.root / 'files' / 'asset_music.mp3'
        subprocess.run([settings.FFMPEG_BIN, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
                        '-f', 'lavfi', '-i', 'sine=frequency=660:duration=2.5',
                        '-c:a', 'libmp3lame', str(music)], check=True)
        data = studio.add_asset(data['id'], music, 'music', 'music.mp3', None)
        config = studio.Top10Config(**data['config'])
        config.scenes[8].asset_id = ''
        config.scenes[9].asset_id = ''
        config.cta_enabled = False
        data = studio.save_project(data['id'], 'One scene plus extra', config, data['revision'])
        data = studio.read_project(data['id'])
        self.assertEqual([item['kind'] for item in studio.timeline(data)], ['scene', 'insert'])
        job_path = self.root / 'jobs' / ('job_' + '4' * 24 + '.json')
        write_json_atomic(job_path, {'status': 'running', 'progress': 0})
        result = studio.render_project(data, job_path)
        video = self.root / 'renders' / result['filename']
        probe = studio.probe_media(video)
        self.assertEqual((probe.width, probe.height, probe.video_codec, probe.audio_codec),
                         (1080, 1920, 'h264', 'aac'))
        self.assertAlmostEqual(probe.duration, 2.5, delta=.3)
        frame = self.root / 'single_extra.png'
        subprocess.run([settings.FFMPEG_BIN, '-nostdin', '-hide_banner', '-loglevel', 'error',
                        '-ss', '1.8', '-i', str(video), '-frames:v', '1', '-y', str(frame)], check=True)
        with Image.open(frame) as image:
            red, green, blue = image.convert('RGB').getpixel((540, 300))
            self.assertGreater(red, 150)
            self.assertGreater(green, 150)
            self.assertLess(blue, 100)

    def test_short_microvideo_loops_after_trim(self):
        data = self.build()
        config = studio.Top10Config(**data['config'])
        config.scenes[7].asset_id = ''
        config.scenes[8].asset_id = ''
        config.inserts[2].asset_id = config.inserts[1].asset_id
        config.inserts[2].start = .4
        config.inserts[2].duration = 1.5
        saved = studio.save_project(data['id'], 'Loop test', config, data['revision'])
        data = studio.read_project(saved['id'])
        job_path = self.root / 'jobs' / ('job_' + '2' * 24 + '.json')
        write_json_atomic(job_path, {'status': 'running', 'progress': 0})
        result = studio.render_project(data, job_path)
        video = self.root / 'renders' / result['filename']
        self.assertAlmostEqual(studio.probe_media(video).duration, 2.5, delta=.3)
        frame = self.root / 'loop_frame.png'
        subprocess.run([settings.FFMPEG_BIN, '-nostdin', '-hide_banner', '-loglevel', 'error',
                        '-ss', '2.2', '-i', str(video), '-frames:v', '1', '-y', str(frame)], check=True)
        with Image.open(frame) as image:
            red, green, blue = image.convert('RGB').getpixel((540, 300))
            self.assertGreater(red, 100)
            self.assertGreater(blue, 100)

    def test_top5_all_five_extras_render_after_scenes(self):
        colors = ('red', 'green', 'blue', 'magenta', 'cyan')
        for slot, color in zip(range(5, 10), colors):
            self.project = studio.add_asset(self.project['id'], self.video(f'asset_top5_scene{slot}.mp4', color),
                                            'video', f'scene{slot}.mp4', slot)
            extra = self.root / 'files' / f'asset_top5_extra{slot}.png'
            Image.new('RGB', (270, 480), 'yellow').save(extra)
            self.project = studio.add_asset(self.project['id'], extra, 'anime_insert', f'extra{slot}.png', slot)
        config = studio.Top10Config(**self.project['config'])
        config.format = 'anime_5'
        config.counters_enabled = False
        for insert, duration in zip(config.anime_inserts, (1.5, 2, 3, 1.5, 2)):
            insert.duration = duration
        saved = studio.save_project(self.project['id'], 'Top 5 test', config, self.project['revision'])
        data = studio.read_project(saved['id'])
        items = studio.timeline(data)
        self.assertEqual([item['kind'] for item in items], ['scene', 'insert'] * 5)
        self.assertEqual([item['rank'] for item in items if item['kind'] == 'insert'], [5, 4, 3, 2, 1])
        self.assertEqual([item['frames'] for item in items if item['kind'] == 'insert'], [45, 60, 90, 45, 60])
        for previous, current in zip(items, items[1:]):
            self.assertEqual(previous['from'] + previous['frames'], current['from'])
        job_path = self.root / 'jobs' / ('job_' + '3' * 24 + '.json')
        write_json_atomic(job_path, {'status': 'running', 'progress': 0})
        result = studio.render_project(data, job_path)
        video = self.root / 'renders' / result['filename']
        probe = studio.probe_media(video)
        self.assertEqual((probe.width, probe.height, probe.video_codec), (1080, 1920, 'h264'))
        self.assertAlmostEqual(probe.duration, 15, delta=.3)
        for item in items:
            at = (item['from'] + item['frames'] / 2) / studio.FPS
            frame = self.root / f'top5_{item["from"]}.png'
            subprocess.run([settings.FFMPEG_BIN, '-nostdin', '-hide_banner', '-loglevel', 'error',
                            '-ss', str(at), '-i', str(video), '-frames:v', '1', '-y', str(frame)], check=True)
            with Image.open(frame) as image:
                red, green, blue = image.convert('RGB').getpixel((540, 300))
                if item['kind'] == 'insert':
                    self.assertGreater(red, 150)
                    self.assertGreater(green, 150)
                    self.assertLess(blue, 100)

    def test_top5_old_project_and_optional_extras(self):
        data = studio.read_project(self.project['id'])
        data['config'].pop('anime_inserts', None)
        studio._write(data)
        self.assertEqual(len(studio.public_project(data)['config']['anime_inserts']), 5)
        for slot in (5, 7):
            self.project = studio.add_asset(data['id'], self.video(f'asset_optional_scene{slot}.mp4', 'red'),
                                            'video', f'scene{slot}.mp4', slot)
        image = self.root / 'files' / 'asset_optional_extra5.png'
        Image.new('RGB', (270, 480), 'yellow').save(image)
        self.project = studio.add_asset(data['id'], image, 'anime_insert', 'extra5.png', 5)
        config = studio.Top10Config(**self.project['config'])
        config.format = 'anime_5'
        config.counters_enabled = False
        saved = studio.save_project(data['id'], 'Top 5 optional', config, self.project['revision'])
        self.assertEqual([item['kind'] for item in studio.timeline(studio.read_project(saved['id']))],
                         ['scene', 'insert', 'scene'])
        removed = studio.delete_asset(data['id'], image.stem)
        self.assertEqual(removed['config']['anime_inserts'][0]['asset_id'], '')
        self.assertEqual([item['kind'] for item in studio.timeline(studio.read_project(data['id']))],
                         ['scene', 'scene'])


if __name__ == '__main__':
    unittest.main()
