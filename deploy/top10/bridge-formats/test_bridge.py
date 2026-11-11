import json
import shutil
import unittest

from fastapi import HTTPException
from pydantic import ValidationError

from routes.top10 import ForgeMaxImport
from services import top10_service as studio
from services.top10_forge_max_bridge import import_clips
from utils.workspace_storage import write_json_atomic, workspace_module_root


class BridgeFormatTests(unittest.TestCase):
    def setUp(self):
        from test_top10_baseline import Top10Tests
        Top10Tests.setUp(self)

    def tearDown(self):
        from test_top10_baseline import Top10Tests
        Top10Tests.tearDown(self)

    def forge_max_fixture(self):
        from test_top10_baseline import Top10Tests
        return Top10Tests.forge_max_fixture(self)

    def extend_fixture(self, video_id, clip_id, source, total):
        root = workspace_module_root('forge_max_extractor') / 'videos' / video_id
        path = root / 'video.json'
        video = json.loads(path.read_text(encoding='utf-8'))
        ids = [clip_id]
        for index in range(1, total):
            new_id = 'extract_' + format(index + 11, 'x') * 16
            target = root / 'clips' / f'cena_{index}.mp4'
            shutil.copy2(source, target)
            video['clips'].append({
                'id': new_id, 'filename': target.name, 'path': str(target),
                'status': 'ready', 'title': f'Cena {index + 1}', 'duration': 29 / 30,
            })
            ids.append(new_id)
        write_json_atomic(path, video)
        return ids

    def test_single_clip_reaches_correct_slot_and_mode(self):
        video_id, clip_id, source = self.forge_max_fixture()
        for mode, first in (('classic', 0), ('anime_5', 5), ('top3', 7)):
            with self.subTest(mode=mode):
                project = import_clips(video_id, [clip_id], f'Test {mode}', mode)
                self.assertEqual(project['config']['format'], mode)
                populated = [slot for slot, scene in enumerate(project['config']['scenes']) if scene['asset_id']]
                self.assertEqual(populated, [first])
                self.assertEqual(studio.timeline(studio.read_project(project['id']))[-1]['rank'], 10 - first)
        self.assertTrue(source.is_file())

    def test_five_and_three_clips_preserve_order_without_touching_sources(self):
        video_id, clip_id, source = self.forge_max_fixture()
        clip_ids = self.extend_fixture(video_id, clip_id, source, 5)
        for mode, selected, slots in (
            ('anime_5', clip_ids, range(5, 10)),
            ('top3', clip_ids[:3], range(7, 10)),
        ):
            with self.subTest(mode=mode):
                project = import_clips(video_id, selected, mode, mode)
                self.assertEqual(project['config']['format'], mode)
                self.assertEqual([
                    project['assets'][project['config']['scenes'][slot]['asset_id']]['origin']['clip_id']
                    for slot in slots
                ], selected)
                self.assertEqual([item['rank'] for item in studio.timeline(studio.read_project(project['id']))
                                  if item['kind'] == 'scene'], list(range(len(selected), 0, -1)))
        self.assertTrue(source.is_file())

    def test_limits_and_invalid_mode_create_no_project(self):
        video_id, clip_id, _ = self.forge_max_fixture()
        before = len(studio.list_projects())
        for mode, count in (('anime_5', 6), ('top3', 4), ('classic', 11), ('wrong', 1)):
            with self.subTest(mode=mode):
                with self.assertRaises(HTTPException) as caught:
                    import_clips(video_id, [f'clip_{i}' for i in range(count)], 'Too many', mode)
                self.assertEqual(caught.exception.status_code, 400)
        self.assertEqual(len(studio.list_projects()), before)

    def test_request_defaults_to_classic_and_accepts_both_new_destinations(self):
        payload = {'video_id': 'extractor_' + 'a' * 16, 'clip_ids': ['extract_' + 'b' * 16]}
        self.assertEqual(ForgeMaxImport(**payload).format, 'classic')
        self.assertEqual(ForgeMaxImport(**payload, format='anime_5').format, 'anime_5')
        self.assertEqual(ForgeMaxImport(**payload, format='top3').format, 'top3')
        with self.assertRaises(ValidationError):
            ForgeMaxImport(**payload, format='wrong')
