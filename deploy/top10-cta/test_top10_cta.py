import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image
from services import top10_service as studio
from services.top10_headline_service import HeadlineConfig, headline_image
from services.top10_cta_service import ASSETS, timing, cta_overlay


class Top10CtaTests(unittest.TestCase):
    def test_original_subscribe_asset_is_unchanged(self):
        self.assertEqual(hashlib.sha256((ASSETS/'subscribe-short-button.png').read_bytes()).hexdigest(),
                         'aab18263d1bb07e49cf7384b4512a1f89a84a286b4121727ddf3c6f79d4c17e5')

    def test_raised_headline_has_transparent_side_margins(self):
        h = HeadlineConfig(enabled=True, text='Quando seu amigo resolve ajudar', x=0, width=1, height=.13,
                           color='#000000', background='#ffffff', font_size=64)
        with tempfile.TemporaryDirectory() as directory, patch.object(studio, 'project_root', return_value=Path(directory)):
            (Path(directory)/'files').mkdir()
            result = headline_image('qa', h)
            with Image.open(Path(directory)/'files'/result['filename']) as image:
                box = image.getchannel('A').getbbox()
                self.assertEqual((box[0], box[2]), (43, 1037))
                self.assertEqual(image.getpixel((0,125))[3], 0)
                self.assertEqual(image.getpixel((1079,125))[3], 0)
                self.assertEqual(box[3]-box[1],182)
            self.assertEqual(result['layout_version'], 3)
            self.assertEqual(result['applied_font_size'],64)

    def test_timing_boundaries_and_segment_intersections(self):
        for total in (1,2,15,30,90,600,18000):
            t = timing(total)
            self.assertTrue(0 <= t['start'] < t['end'] <= total)
            self.assertLessEqual(t['length'],90)
        t = timing(238)
        self.assertEqual(t['start'],75)
        self.assertEqual(cta_overlay(1,'video',0,60,238),([],[],'video'))
        inputs, filters, label = cta_overlay(3,'branded',118,120,238)
        self.assertEqual(inputs.count('-i'),2)
        self.assertIn('[-', ''.join(filters).replace('PTS+(', '['))
        self.assertEqual(label,'withCta')

    def test_logo_and_optional_cta_defaults_remain_independent(self):
        config = studio.Top10Config()
        self.assertTrue(config.cta_enabled)
        self.assertFalse(config.logo_enabled)
        self.assertEqual(config.logo_x,.12)
        self.assertEqual(config.logo_y,.9)
        self.assertEqual(config.logo_size,.14)
        self.assertFalse(studio.Top10Config(cta_enabled=False).cta_enabled)

    @unittest.skipUnless(os.environ.get('TOP10_CTA_SMOKE') == '1', 'Set TOP10_CTA_SMOKE=1 for actual MP4 verification')
    def test_real_render_preserves_duration_audio_and_cross_segment_animation(self):
        persistent = os.environ.get('TOP10_CTA_OUTPUT')
        temporary = tempfile.TemporaryDirectory(prefix='top10-cta-qa-') if not persistent else None
        root = Path(persistent or temporary.name)
        root.mkdir(parents=True,exist_ok=True)
        for folder in ('files','renders','jobs'):
            (root/folder).mkdir(exist_ok=True)
        source = root/'files'/'scene.mp4'
        subprocess.run([studio.settings.FFMPEG_BIN,'-v','error','-y','-f','lavfi','-i','color=c=0x305966:s=1080x1920:r=30',
                        '-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','4','-c:v','libx264','-threads','1',
                        '-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',str(source)],check=True,capture_output=True)
        Image.new('RGB',(200,200),'#19bc80').save(root/'files'/'logo.png')
        config = studio.Top10Config(logo_enabled=True)
        for slot, end in ((0,2),(1,4)):
            config.scenes[slot].asset_id='video'
            config.scenes[slot].end=end
            config.scenes[slot].headline=HeadlineConfig(enabled=True,text='Esse amigo sempre aparece na melhor hora',x=0,y=.08,width=1,height=.13,
                                                       color='#000000',background='#ffffff',font_size=64)
        data = dict(id='top10_'+'0'*24, config=config.model_dump(), assets={
            'video':dict(filename='scene.mp4',kind='video',has_audio=True,duration=4,width=1080,height=1920),
            'logo':dict(filename='logo.png',kind='logo',width=200,height=200)}, logo='logo', music='')
        results={}
        with patch.object(studio,'project_root',return_value=root):
            for enabled in (False,True):
                data['config']['cta_enabled']=enabled
                job=root/'jobs'/f'{enabled}.json'
                job.write_text(json.dumps(dict(cancel_requested=False)))
                results[str(enabled)] = studio.render_project(data,job)
        duration = results['True']['duration']
        self.assertEqual(duration, results['False']['duration'])
        expected_frames=round(duration*30)
        on=root/'renders'/results['True']['filename']
        off=root/'renders'/results['False']['filename']
        for file in (on,off):
            info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(file)]))
            v=next(s for s in info['streams'] if s['codec_type']=='video')
            a=next(s for s in info['streams'] if s['codec_type']=='audio')
            self.assertEqual((v['codec_name'],v['width'],v['height'],v['pix_fmt']),('h264',1080,1920,'yuv420p'))
            self.assertEqual((a['codec_name'],a['sample_rate']),('aac','48000'))
            self.assertEqual(int(v['nb_frames']),expected_frames)
            subprocess.run([studio.settings.FFMPEG_BIN,'-v','error','-i',str(file),'-f','null','-'],check=True,capture_output=True)
        def frame(file,number):
            raw=subprocess.check_output([studio.settings.FFMPEG_BIN,'-v','error','-i',str(file),'-vf',f'select=eq(n\\,{number})',
                                         '-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'])
            return np.frombuffer(raw,dtype=np.uint8).reshape(1920,1080,3).astype(np.int16)
        measurements={}
        for number in (60,85,100,130,180):
            rendered,control=frame(on,number),frame(off,number)
            difference=float(np.abs(rendered[1360:1460,315:766]-control[1360:1460,315:766]).mean())
            measurements[str(number)]=difference
            self.assertGreater(difference,5) if number in (85,100,130) else self.assertLess(difference,2)
            self.assertLess(float(np.abs(rendered[1653:1804,54:205]-control[1653:1804,54:205]).mean()),2)
            if number==130:
                Image.fromarray(rendered.astype(np.uint8)).save(root/'render-with-cta.png')
        def audio(file):
            raw=subprocess.check_output([studio.settings.FFMPEG_BIN,'-v','error','-i',str(file),'-vn','-f','s16le','-ac','1','-ar','48000','-'])
            return np.frombuffer(raw,dtype=np.int16)
        left,right=audio(on),audio(off)
        self.assertEqual(len(left),len(right))
        self.assertLess(float(np.abs(left.astype(float)-right.astype(float)).mean()),1)
        (root/'result.json').write_text(json.dumps(dict(results=results,measurements=measurements,duration=duration),indent=2))
        (root/'fixture.json').write_text(json.dumps(data | dict(title='QA headline e CTA',revision=1,job=None,last_render=results['True'],
                                                              created_at='2026-10-24T00:00:00Z',updated_at='2026-10-24T00:00:00Z')),encoding='utf-8')
        print(f'TOP10_CTA_MP4=OK\nOUTPUT={on}',flush=True)
        if temporary:
            temporary.cleanup()


if __name__=='__main__':
    unittest.main(verbosity=2)
