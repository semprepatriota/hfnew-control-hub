import json
from fractions import Fraction
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest

from services.forge_max import extractor_service as extractor
from services.forge_max import scene_detector


class ForgeMaxCutPrecisionTests(unittest.TestCase):
    def test_legacy_rounded_boundaries_resolve_to_the_original_frame_grid(self):
        self.assertEqual(extractor._frame_window(0,1.067,Fraction(30),94),(0,32/30,32))
        self.assertEqual(extractor._frame_window(1.067,2.2,Fraction(30),94),(32/30,2.2,34))
        self.assertEqual(extractor._frame_window(0,1.068,Fraction(30000,1001),94)[2],32)
        self.assertEqual(extractor._frame_window(2.2,3.134,Fraction(30),94)[2],28)

    def test_boundary_precision_is_not_reduced_to_milliseconds(self):
        segments=extractor._merge_boundaries([32/30,66/30],94/30)
        self.assertAlmostEqual(segments[0][1],32/30,places=8)
        self.assertEqual(segments[0][1],segments[1][0])

    def test_refinement_preserves_short_shots_scene_count_and_gap_free_coverage(self):
        segments=[(0,20.8),(20.8,21.6),(21.6,22.533333)]
        refined=extractor._refine_scene_segments(segments,[{'candidate':21.6,'refined':646/30}])
        self.assertEqual(len(refined),3)
        self.assertAlmostEqual(refined[1][1],646/30,places=8)
        self.assertEqual(refined[1][1],refined[2][0])
        self.assertGreater(refined[1][1]-refined[1][0],.25)

    def test_accepted_hard_cut_is_refined_but_a_flash_is_not(self):
        import numpy as np
        from types import SimpleNamespace
        def history(values):
            return [(SimpleNamespace(get_frames=lambda n=n:n),np.full((10,10,3),value,dtype=np.uint8)) for n,value in enumerate(values)]
        self.assertEqual(scene_detector.refine_hard_cut_frame(history([0,0,200,200,200,200]),4),2)
        self.assertEqual(scene_detector.refine_hard_cut_frame(history([0,0,200,0,0,0]),4),4)
        self.assertEqual(scene_detector.refine_hard_cut_frame(history([0,20,40,60,80,100]),4),4)

    @unittest.skipUnless(shutil.which('ffmpeg'),'FFmpeg unavailable')
    def test_real_exports_do_not_include_any_frame_from_the_next_or_previous_scene(self):
        import numpy as np
        for fps,lengths in [(25,[27,28,24]),(30,[32,34,28]),(60,[64,68,56]),(30000/1001,[32,34,28])]:
            with self.subTest(fps=fps),tempfile.TemporaryDirectory() as directory:
                root=Path(directory)
                source=root/'original.mp4'
                frames=[np.full((90,160,3),colour,dtype=np.uint8).tobytes()
                    for colour,count in zip([(255,0,0),(0,0,255),(0,255,0)],lengths) for _ in range(count)]
                subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24',
                    '-s','160x90','-r',str(fps),'-i','pipe:0','-an','-c:v','libx264','-threads','1',
                    '-g','300','-keyint_min','300','-sc_threshold','0','-pix_fmt','yuv420p',str(source)],input=b''.join(frames),check=True,capture_output=True,timeout=30)
                clips=[]
                offset=0
                for index,count in enumerate(lengths):
                    clip_id='extract_'+f'{index:016x}'
                    path=root/'clips'/f'{index}.mp4'
                    clips.append({'id':clip_id,'path':str(path),'filename':path.name,
                        'start_seconds':round(offset/fps,3),'end_seconds':round((offset+count)/fps,3),'status':'extracting'})
                    offset+=count
                extractor._write_manifest(root,{'id':'extractor_'+'b'*16,'source_path':str(source),'clips':clips})
                for index,clip in enumerate(clips):
                    extractor._extract_clip(root,clip['id'],task_key=f'clip:precision:{index}',cancel_event=threading.Event())
                    saved=extractor._read_manifest_from_dir(root)['clips'][index]
                    self.assertEqual(saved['status'],'ready',saved.get('error'))
                    self.assertEqual(saved['frame_count'],lengths[index])
                    self.assertEqual(saved['cut_precision'],'frame_exact_v1')
                    raw=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-i',clip['path'],
                        '-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'])
                    colours=np.argmax(np.frombuffer(raw,dtype=np.uint8).reshape(-1,3),axis=1)
                    self.assertEqual(len(colours),lengths[index])
                    self.assertTrue(all(colour==[0,2,1][index] for colour in colours))


if __name__=='__main__': unittest.main()
