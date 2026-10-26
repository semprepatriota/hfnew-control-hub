"""TOP 10 format regression tests; all MP4 fixtures use disposable storage."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
from fastapi import HTTPException
from services import top10_service as studio


def fixture(count=10):
    config = studio.Top10Config(counters_enabled=False)
    for slot in range(count):
        config.scenes[slot].asset_id = ('red', 'green', 'blue')[slot % 3]
        config.scenes[slot].start = .1
        config.scenes[slot].end = .5
    return dict(id='top10_'+'1'*24, config=config.model_dump(),
                assets={color:dict(id=color, filename=color+'.mp4', kind='video', has_audio=True,
                                  duration=1, width=1080, height=1920, name=color)
                        for color in ('red','green','blue')}, logo='', music='', revision=1)


class NoCountersTests(unittest.TestCase):
    def test_old_configs_keep_counters_and_false_survives_serialization(self):
        self.assertTrue(studio.Top10Config().counters_enabled)
        self.assertFalse(studio.Top10Config(**fixture()['config']).model_dump()['counters_enabled'])

    def test_ten_scenes_are_contiguous_and_preserve_trims(self):
        data = fixture()
        items = studio.timeline(data)
        self.assertEqual(len(items),10)
        self.assertTrue(all(item['kind']=='scene' and item['frames']==12 for item in items))
        self.assertEqual([item['from'] for item in items],list(range(0,120,12)))
        data['config']['counters_enabled']=True
        self.assertEqual(len(studio.timeline(data)),20)
        self.assertEqual(data['config']['model'],'pink3d')

    def test_partial_projects_and_empty_project(self):
        data=fixture(1)
        data['config']['scenes'][9]=data['config']['scenes'][0]
        self.assertEqual([item['slot'] for item in studio.timeline(data)],[0,9])
        with self.assertRaises(HTTPException):
            studio.timeline(fixture(0))

    def test_export_preflight_does_not_require_any_counter_files(self):
        data=fixture(2)
        with tempfile.TemporaryDirectory() as directory, patch.object(studio,'read_project',return_value=data), \
             patch.object(studio,'_assert_idle'), patch.object(studio,'project_root',return_value=Path(directory)), \
             patch.object(studio,'_job_path',return_value=Path(directory)/'job.json'), \
             patch.object(studio,'_write'), patch.object(studio,'write_json_atomic'), \
             patch.object(studio,'get_current_user_context',return_value={}), \
             patch.object(studio,'counter_path',side_effect=AssertionError('Counter must not be read')), \
             patch.object(studio,'_ACTIVE',set()), patch.object(studio,'_EXECUTOR'):
            self.assertEqual(studio.start_render(data['id'],1)['status'],'queued')

    @unittest.skipUnless(os.environ.get('TOP10_FORMAT_SMOKE')=='1','Set TOP10_FORMAT_SMOKE=1 for MP4 verification')
    def test_real_mp4_contains_only_the_ten_scenes_in_order(self):
        output=os.environ.get('TOP10_FORMAT_OUTPUT')
        temporary=None if output else tempfile.TemporaryDirectory(prefix='top10-format-qa-')
        root=Path(output or temporary.name)
        for folder in ('files','renders','jobs'):
            (root/folder).mkdir(parents=True,exist_ok=True)
        data=fixture()
        for color,frequency in (('red',440),('green',660),('blue',880)):
            subprocess.run([studio.settings.FFMPEG_BIN,'-v','error','-y','-f','lavfi','-i',
                f'color=c={color}:s=1080x1920:r=30','-f','lavfi','-i',f'sine=frequency={frequency}:sample_rate=48000',
                '-t','1','-c:v','libx264','-threads','1','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',
                str(root/'files'/(color+'.mp4'))],check=True,capture_output=True)
        job=root/'jobs'/'qa.json'
        job.write_text(json.dumps(dict(cancel_requested=False)))
        with patch.object(studio,'project_root',return_value=root), \
             patch.object(studio,'counter_path',side_effect=AssertionError('Counter must not be rendered')):
            result=studio.render_project(data,job)
        self.assertEqual(result['duration'],4)
        file=root/'renders'/result['filename']
        info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(file)]))
        video=next(s for s in info['streams'] if s['codec_type']=='video')
        audio=next(s for s in info['streams'] if s['codec_type']=='audio')
        self.assertEqual((video['codec_name'],video['width'],video['height'],video['pix_fmt'],int(video['nb_frames'])),
                         ('h264',1080,1920,'yuv420p',120))
        self.assertEqual(audio['codec_name'],'aac')
        # Check both sides of every join, not just one thumbnail per clip.
        for slot in range(10):
            for offset in (0,5,11):
                frame=slot*12+offset
                raw=subprocess.check_output([studio.settings.FFMPEG_BIN,'-v','error','-i',str(file),'-vf',
                    f'select=eq(n\\,{frame}),crop=16:16:0:0','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'])
                mean=np.frombuffer(raw,dtype=np.uint8).reshape(-1,3).mean(axis=0)
                self.assertEqual(int(mean.argmax()),slot%3,(slot,offset,mean))
        raw=subprocess.check_output([studio.settings.FFMPEG_BIN,'-v','error','-i',str(file),'-vn','-f','s16le','-ac','1','-ar','48000','-'])
        samples=np.frombuffer(raw,dtype=np.int16).astype(float)
        for slot in range(10):
            part=samples[int((slot*.4+.1)*48000):int((slot*.4+.3)*48000)]
            hz=float(np.fft.rfftfreq(len(part),1/48000)[np.abs(np.fft.rfft(part)).argmax()])
            self.assertAlmostEqual(hz,(440,660,880)[slot%3],delta=8)
        subprocess.run([studio.settings.FFMPEG_BIN,'-v','error','-i',str(file),'-f','null','-'],check=True,capture_output=True)
        data.update(title='QA sem contadores',last_render=result,scene_headlines=data.get('scene_headlines',{}))
        (root/'fixture.json').write_text(json.dumps(data),encoding='utf-8')
        print(f'TOP10_NO_COUNTERS_MP4=OK\nOUTPUT={file}',flush=True)
        if temporary:
            temporary.cleanup()


if __name__=='__main__':
    unittest.main(verbosity=2)
