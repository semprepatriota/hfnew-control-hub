import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from unittest.mock import patch

from fastapi import HTTPException
from PIL import Image
from starlette.requests import Request

from config import settings
from services import top10_service as studio
from services.access_policy import module_for_api_path
from services.billing_store import meter_for_request
from utils.request_auth import is_public_api_request
from utils.user_context import reset_current_user, set_current_user
from utils.workspace_storage import write_json_atomic
from utils.workspace_storage import workspace_module_root


class Top10Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.storage = settings.STORAGE_DIR
        self.secret = settings.SECRET_KEY
        settings.STORAGE_DIR = str(Path(self.temp.name) / "storage")
        settings.SECRET_KEY = "top10-test-secret-at-least-thirty-two-characters"
        self.context = {"role": "guest", "workspace_type": "personal", "storage_scope": "test_top10_a", "workspace_id": "ws_top10_a"}
        self.token = set_current_user(self.context)
        self.project = studio.create_project("Test TOP 10")
        self.root = studio.project_root(self.project["id"])

    def tearDown(self):
        reset_current_user(self.token)
        settings.STORAGE_DIR = self.storage
        settings.SECRET_KEY = self.secret
        self.temp.cleanup()

    def test_twenty_slots_descending_and_frame_accurate_cuts(self):
        data = studio.read_project(self.project["id"])
        data["assets"]["a"] = {"kind": "video", "duration": 5}
        for scene in data["config"]["scenes"]:
            scene.update(asset_id="a", start=1, end=2.5)
        items = studio.timeline(data)
        self.assertEqual(len(items), 20)
        self.assertEqual([item["rank"] for item in items[::2]], list(range(10, 0, -1)))
        self.assertEqual([item["frames"] for item in items[1::2]], [45] * 10)
        self.assertEqual(items[-1]["from"] + items[-1]["frames"], 739)
        data["config"]["model"] = "film"
        cinema = studio.timeline(data)
        self.assertEqual([item["frames"] for item in cinema[::2]], [30, 25, 28, 26, 28, 30, 27, 28, 28, 29])
        data["config"]["scenes"][8]["asset_id"] = ""
        partial = studio.timeline(data)
        self.assertEqual(len(partial), 18)
        self.assertNotIn(2, [item['rank'] for item in partial])
        data["config"]["scenes"][8]["asset_id"] = "missing"
        with self.assertRaises(HTTPException):
            studio.timeline(data)

    def test_partial_timeline_ends_at_three_and_rejects_empty_export(self):
        data = studio.read_project(self.project['id'])
        with self.assertRaises(HTTPException) as empty:
            studio.timeline(data)
        self.assertEqual(empty.exception.status_code, 400)
        data['assets']['a'] = {'kind': 'video', 'duration': 1}
        for scene in data['config']['scenes'][:8]:
            scene.update(asset_id='a', end=1)
        items = studio.timeline(data)
        self.assertEqual([item['rank'] for item in items[::2]], list(range(10, 2, -1)))
        self.assertEqual(len(items), 16)
        for previous, current in zip(items, items[1:]):
            self.assertEqual(current['from'], previous['from'] + previous['frames'])

    def test_revision_and_workspace_isolation(self):
        config = studio.Top10Config(**self.project["config"])
        studio.save_project(self.project["id"], "Changed", config, self.project["revision"])
        with self.assertRaises(HTTPException) as conflict:
            studio.save_project(self.project["id"], "Stale", config, self.project["revision"])
        self.assertEqual(conflict.exception.status_code, 409)
        other = set_current_user({**self.context, "storage_scope": "test_top10_b"})
        try:
            with self.assertRaises(HTTPException) as missing:
                studio.read_project(self.project["id"])
            self.assertEqual(missing.exception.status_code, 404)
        finally:
            reset_current_user(other)

    def test_packaged_counters_have_the_exact_timeline_frame_counts(self):
        for model, metadata in studio.MODELS.items():
            for rank in range(10, 0, -1):
                path = studio.counter_path(model, rank)
                probe = json.loads(subprocess.check_output([
                    settings.FFPROBE_BIN, "-v", "error", "-show_streams", "-of", "json", str(path)
                ]))
                video = next(stream for stream in probe["streams"] if stream["codec_type"] == "video")
                self.assertEqual(int(video["nb_frames"]), metadata.get("frames_by_rank", {}).get(str(rank), metadata["frames"]))
                self.assertEqual((video["width"], video["height"]), (1080, 1920))
                self.assertEqual(video["pix_fmt"], "yuv420p")
                self.assertTrue(any(stream["codec_type"] == "audio" for stream in probe["streams"]))

    def test_recreated_counters_use_the_original_sound(self):
        packets = []
        for rank in [3, 2, 1]:
            path = studio.counter_path('pink3d', rank)
            probe = json.loads(subprocess.check_output([
                settings.FFPROBE_BIN, '-v', 'error', '-select_streams', 'a:0', '-show_packets',
                '-show_data_hash', 'sha256', '-show_entries', 'packet=data_hash', '-of', 'json', str(path)
            ]))
            packets.append([packet['data_hash'] for packet in probe['packets']])
        self.assertGreater(len(packets[0]), 30)
        self.assertEqual(packets[0], packets[1])
        self.assertEqual(packets[0], packets[2])

    def test_optional_headlines_default_off_and_shared_preview_image(self):
        from services.top10_headline_service import HeadlineConfig, prepare_headlines
        data = studio.read_project(self.project['id'])
        self.assertFalse(studio.SceneConfig().headline.enabled)
        data['assets']['a'] = {'kind': 'video', 'duration': 1, 'filename': 'fixture.mp4'}
        data['config']['scenes'][0].update(asset_id='a', end=1)
        prepare_headlines(data)
        self.assertEqual(data['scene_headlines'], {})
        h = HeadlineConfig(enabled=True, text='O plano parecia perfeito', width=.8, height=.15, background='#ff0000')
        data['config']['scenes'][0]['headline'] = h.model_dump()
        prepare_headlines(data)
        self.assertEqual(set(data['scene_headlines']), {'0'})
        image = data['scene_headlines']['0']
        with Image.open(self.root / 'files' / image['filename']) as png:
            self.assertEqual(png.size, (864, 288))
            self.assertEqual(png.getpixel((0,0)), (255,0,0,255))
        self.assertIn('url', studio.public_project(data)['scene_headlines']['0'])
        h.cover_original = False
        data['config']['scenes'][0]['headline'] = h.model_dump()
        prepare_headlines(data)
        with Image.open(self.root / 'files' / data['scene_headlines']['0']['filename']) as png:
            self.assertEqual(png.getpixel((0,0))[3], 0)

    def test_manual_comedy_translation_generation_is_cached_and_workspace_scoped(self):
        from services import top10_headline_service as captions
        source = self.root / 'files/source.mp4'
        shutil.copy2(studio.counter_path('pink3d', 3), source)
        data = studio.read_project(self.project['id'])
        data['assets']['a'] = {'kind':'video', 'filename':source.name, 'duration':29/30}
        data['config']['scenes'][0].update(asset_id='a', end=29/30)
        data = studio._write(data)
        result = {'headline':'O plano deu errado. Quem faria igual?', 'original_text':'Trust me', 'translation':'Confia em mim', 'box':{'x':.05,'y':.1,'width':.9,'height':.1}, 'text_found':True}
        with patch.object(captions, '_provider_answer', return_value=result) as provider:
            request_id = 'd' * 32
            first = captions.generate_headline(data['id'], 0, data['revision'], 'a', request_id)
            second = captions.generate_headline(data['id'], 0, data['revision'], 'a', request_id)
            self.assertEqual(first, second)
            self.assertEqual(provider.call_count, 1)
            self.assertEqual(len(provider.call_args.args[0]), 3)
            self.assertTrue(all(frame.startswith(b'\xff\xd8') for frame in provider.call_args.args[0]))
            with self.assertRaises(HTTPException) as stale:
                captions.generate_headline(data['id'], 0, data['revision']+1, 'a', 'e'*32)
            self.assertEqual(stale.exception.status_code, 409)
        other = set_current_user({**self.context, 'storage_scope':'different_caption_owner'})
        try:
            with self.assertRaises(HTTPException) as denied:
                captions.generate_headline(data['id'], 0, data['revision'], 'a', 'e'*32)
            self.assertEqual(denied.exception.status_code, 404)
        finally:
            reset_current_user(other)

    def test_comedy_provider_uses_separate_prompt_and_never_returns_generic_fallback(self):
        from services import top10_headline_service as captions
        payload = {'original_text':'Trust me', 'translation':'Confia em mim', 'headline':'O plano deu errado. Quem faria igual?', 'text_found':True, 'caption_kind':'caption', 'box':{'x':.05,'y':.1,'width':.9,'height':.1}}
        from unittest.mock import Mock
        response = Mock(status_code=200)
        response.json.return_value = {'choices':[{'message':{'content':json.dumps(payload)}}]}
        with patch.object(captions, 'get_central_chatgpt_config', return_value={'api_key':'test-only-not-a-real-key','model':'test-vision'}), patch.object(captions.requests,'post',return_value=response) as post:
            result = captions._provider_answer([b'jpeg']*3, '')
            self.assertEqual(result['translation'], 'Confia em mim')
            request = post.call_args.kwargs['json']
            self.assertIn('comedy', request['messages'][0]['content'])
            self.assertIn('untrusted', request['messages'][0]['content'])
            self.assertEqual(request['model'], 'test-vision')
            self.assertEqual(len(request['messages'][1]['content']), 4)
            for kind in ('watermark', 'caption'):
                watermark = {**payload, 'original_text':'Fluffel', 'translation':'Fluffel', 'caption_kind':kind}
                response.json.return_value = {'choices':[{'message':{'content':json.dumps(watermark)}}]}
                filtered = captions._provider_answer([b'jpeg']*3, '')
                self.assertFalse(filtered['text_found'])
                self.assertEqual(filtered['translation'], '')
            response.status_code = 429
            with self.assertRaises(HTTPException) as limited:
                captions._provider_answer([b'jpeg']*3, '')
            self.assertEqual(limited.exception.status_code, 429)

    def forge_max_fixture(self):
        self.context.update(platform_role='workspace_admin', access={'modules': {'forge_max': True, 'top10': True}})
        video_id, clip_id = 'extractor_' + 'a' * 16, 'extract_' + 'b' * 16
        root = workspace_module_root('forge_max_extractor') / 'videos' / video_id
        (root / 'clips').mkdir(parents=True)
        (root / 'source').mkdir()
        source = root / 'clips/cena.mp4'
        shutil.copy2(studio.counter_path('pink3d', 3), source)
        write_json_atomic(root / 'video.json', {
            'id': video_id, 'source_path': str(root / 'source/original.mp4'),
            'media_key': 'top10-test-media-key', 'status': 'ready', 'analysis_status': 'completed',
            'proxy_ready': False, 'waveform_ready': False, 'duration': 1, 'created_at': '',
            'clips': [{'id': clip_id, 'filename': source.name, 'path': str(source), 'status': 'ready', 'title': 'Cena escolhida', 'duration': 29/30}],
        })
        return video_id, clip_id, source

    def test_forge_max_import_survives_deleting_the_extracted_original(self):
        from services.top10_forge_max_bridge import import_clips
        video_id, clip_id, source = self.forge_max_fixture()
        imported = import_clips(video_id, [clip_id], 'Importado')
        scene = imported['config']['scenes'][0]
        asset = imported['assets'][scene['asset_id']]
        self.assertEqual(asset['origin']['clip_id'], clip_id)
        self.assertEqual(asset['name'], 'Cena escolhida')
        self.assertEqual(len(imported['config']['scenes']), 10)
        self.assertTrue(asset['thumbnail_url'])
        target = studio.project_root(imported['id']) / 'files' / asset['filename']
        source.unlink()
        self.assertTrue(target.is_file())
        self.assertGreater(target.stat().st_size, 0)

    def test_forge_max_import_rejects_other_workspaces_and_duplicate_selections(self):
        from services.top10_forge_max_bridge import import_clips
        video_id, clip_id, _ = self.forge_max_fixture()
        with self.assertRaises(HTTPException):
            import_clips(video_id, [clip_id, clip_id], 'Duplicado')
        other = set_current_user({**self.context, 'storage_scope': 'top10_import_other'})
        try:
            with self.assertRaises(HTTPException) as missing:
                import_clips(video_id, [clip_id], 'Outro workspace')
            self.assertEqual(missing.exception.status_code, 404)
            self.assertEqual(studio.list_projects(), [])
        finally:
            reset_current_user(other)
        self.context['access']['modules']['forge_max'] = False
        with self.assertRaises(HTTPException) as denied:
            import_clips(video_id, [clip_id], 'Sem acesso')
        self.assertEqual(denied.exception.status_code, 403)

    def test_forge_max_failed_import_removes_only_the_new_project(self):
        from services.top10_forge_max_bridge import import_clips
        video_id, clip_id, source = self.forge_max_fixture()
        before = {p['id'] for p in studio.list_projects()}
        run = subprocess.run
        def fail_thumbnail(command, **kwargs):
            if str(command[-1]).endswith('.jpg'):
                self.assertEqual(len(studio.list_projects()), len(before) + 1)
                raise RuntimeError('Thumbnail failure')
            return run(command, **kwargs)
        with patch('services.top10_forge_max_bridge.subprocess.run', side_effect=fail_thumbnail):
            with self.assertRaises(RuntimeError):
                import_clips(video_id, [clip_id], 'Falha')
        self.assertTrue(source.exists())
        self.assertEqual({p['id'] for p in studio.list_projects()}, before)

    def test_signed_media_and_range_do_not_expose_unsigned_files(self):
        path = self.root / "files" / "asset_test.mp4"
        path.write_bytes(bytes(range(100)))
        url = studio.media_url(self.project["id"], path.name)
        query = {key: value[0] for key, value in parse_qs(urlsplit(url).query).items()}
        resolved = studio.resolve_media(self.project["id"], path.name, query["scope"], int(query["expires"]), query["sig"])
        self.assertEqual(resolved, path)
        with self.assertRaises(HTTPException):
            studio.resolve_media(self.project["id"], path.name, query["scope"], int(query["expires"]), "wrong")
        request = Request({"type": "http", "method": "GET", "headers": [(b"range", b"bytes=25-49")]})
        response = studio.stream_media(path, request)
        async def consume():
            return b"".join([chunk async for chunk in response.body_iterator])
        self.assertEqual(response.status_code, 206)
        self.assertEqual(asyncio.run(consume()), bytes(range(25, 50)))
        self.assertEqual(module_for_api_path("/api/top10/projects"), "top10")
        self.assertFalse(is_public_api_request("/api/top10/projects"))
        self.assertTrue(is_public_api_request(urlsplit(url).path))
        self.assertFalse(is_public_api_request(urlsplit(url).path, "DELETE"))
        self.assertEqual(meter_for_request(f"/api/top10/projects/{self.project['id']}/exports", "POST"), "render_jobs")

    def test_restarted_job_fails_honestly_and_keeps_project(self):
        job_id = "job_" + "a" * 24
        path = studio._job_path(self.project["id"], job_id)
        write_json_atomic(path, {"id": job_id, "status": "running"})
        self.assertEqual(studio.get_job(self.project["id"], job_id)["status"], "failed")
        self.assertEqual(studio.read_project(self.project["id"])["id"], self.project["id"])

    def test_complete_export_with_ten_scenes_music_title_and_logo(self):
        self.assert_export(10)

    def test_partial_export_ends_at_three_with_music_title_and_logo(self):
        self.assert_export(8)

    def assert_export(self, scene_count):
        if os.getenv("TOP10_SKIP_MEDIA_TEST") == "1":
            self.skipTest("Media test disabled explicitly")
        source = self.root / "files" / "source.mp4"
        subprocess.run([settings.FFMPEG_BIN, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=320x240:r=30:d=1", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(source)], check=True, timeout=30)
        data = studio.read_project(self.project["id"])
        data["assets"] = {"source": {"kind": "video", "filename": source.name, "duration": 1, "has_audio": True}}
        for scene in data["config"]["scenes"][:scene_count]:
            scene.update(asset_id="source", start=0.2, end=0.6)
        data["config"].update(model=os.getenv("TOP10_TEST_MODEL", "pink3d"), title_enabled=True, title="TOP 10 TEST", title_size=60, logo_enabled=True, logo_x=0.85, logo_y=0.9, music_volume=0.1)
        data['config']['scenes'][0]['headline'] = {'enabled':True, 'text':'O plano parecia perfeito', 'x':0, 'y':.35, 'width':1, 'height':.1}
        music = self.root / "files" / "music.wav"
        subprocess.run([settings.FFMPEG_BIN, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=0.5:sample_rate=48000", str(music)], check=True, timeout=30)
        logo = self.root / "files" / "logo.png"
        Image.new("RGBA", (100, 100), (0, 255, 0, 200)).save(logo)
        data["assets"].update({"music": {"filename": music.name, "kind": "music"}, "logo": {"filename": logo.name, "kind": "logo", "width": 100, "height": 100}})
        data.update(music="music", logo="logo")
        studio._title_image(data)
        job_id = "job_" + "b" * 24
        job = studio._job_path(data["id"], job_id)
        write_json_atomic(job, {"status": "running", "cancel_requested": False})
        result = studio.render_project(data, job)
        expected_duration = sum(item["frames"] for item in studio.timeline(data)) / studio.FPS
        self.assertAlmostEqual(result["duration"], expected_duration, places=2)
        output = self.root / "renders" / result["filename"]
        probe = studio.probe_media(output)
        self.assertEqual(probe.video_codec, "h264")
        self.assertEqual(probe.audio_codec, "aac")
        frame = Path(self.temp.name) / "scene.png"
        subprocess.run([settings.FFMPEG_BIN, "-hide_banner", "-loglevel", "error", "-ss", "1.1", "-i", str(output), "-frames:v", "1", "-y", str(frame)], check=True, timeout=30)
        with Image.open(frame) as image:
            r, g, b = image.convert("RGB").getpixel((100, 1000))
            self.assertGreater(r, 180)
            self.assertLess(g, 50)
            self.assertLess(b, 50)
            self.assertLess(max(image.convert('RGB').getpixel((10, 700))), 40)
        # The exact caption PNG appears only on its scene, never on the next scene or the counters.
        for item in [studio.timeline(data)[0], studio.timeline(data)[3]]:
            check = Path(self.temp.name) / ('frame_' + str(item['from']) + '.png')
            subprocess.run([settings.FFMPEG_BIN,'-hide_banner','-loglevel','error','-ss',str(item['from']/studio.FPS+.1),'-i',str(output),'-frames:v','1','-y',str(check)],check=True,timeout=30)
            with Image.open(check) as image:
                self.assertGreater(max(image.convert('RGB').getpixel((10,700))), 100)
        if os.getenv("TOP10_TEST_OUTPUT"):
            destination = Path(os.environ["TOP10_TEST_OUTPUT"])
            destination.mkdir(parents=True, exist_ok=True)
            shutil.copy2(output, destination / "top10-full-smoke.mp4")
            shutil.copy2(frame, destination / "top10-full-smoke.png")


if __name__ == "__main__":
    unittest.main()
