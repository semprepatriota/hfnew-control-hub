import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image
from services import top10_service as studio
from services.top10_headline_service import HeadlineConfig, PAINT_KEYS, headline_image


class CompactHeadlineTests(unittest.TestCase):
    def test_compact_band_keeps_text_font_width_and_center(self):
        headline = HeadlineConfig(enabled=True, text='Quando seu marido insiste em ajudar', x=0, width=1, height=.13,
                                  font_size=64, color='#000000', background='#ffffff')
        with tempfile.TemporaryDirectory() as folder, patch.object(studio, 'project_root', return_value=Path(folder)):
            (Path(folder) / 'files').mkdir()
            result = headline_image('test', headline)
            with Image.open(Path(folder) / 'files' / result['filename']) as image:
                left, top, right, bottom = image.getchannel('A').getbbox()
                self.assertEqual((image.width, image.height), (1080, 250))
                self.assertEqual((left, right), (0, 1080))
                self.assertEqual(bottom - top, 182)
                self.assertLessEqual(abs((top + bottom) / 2 - image.height / 2), 1)
                self.assertEqual(image.getpixel((0, 0))[3], 0)
                self.assertEqual(image.getpixel((0, image.height - 1))[3], 0)
            self.assertEqual(result['applied_font_size'], 64)
            self.assertEqual(result['settings'], {key: getattr(headline, key) for key in PAINT_KEYS})
            self.assertEqual(result['layout_version'], 2)
            old_digest = hashlib.sha256(('v1|' + json.dumps(result['settings'], sort_keys=True)).encode()).hexdigest()[:20]
            self.assertNotEqual(result['filename'], f'headline_{old_digest}.png')

    def test_long_text_still_fits_and_no_background_stays_transparent(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(studio, 'project_root', return_value=Path(folder)):
            (Path(folder) / 'files').mkdir()
            for text in ['Que ideia foi essa?', 'Quando voce acha que tudo vai dar certo, mas seu amigo resolve ajudar e muda completamente o final da historia.']:
                h = HeadlineConfig(enabled=True, text=text, width=1, height=.3, color='#000000', background='#ffffff')
                result = headline_image('test', h)
                with Image.open(Path(folder) / 'files' / result['filename']) as image:
                    self.assertLess(image.getchannel('A').getbbox()[3] - image.getchannel('A').getbbox()[1], image.height)
                h.cover_original = False
                transparent = headline_image('test', h)
                with Image.open(Path(folder) / 'files' / transparent['filename']) as image:
                    self.assertEqual(image.getpixel((0, image.height // 2))[3], 0)


if __name__ == '__main__':
    unittest.main()
