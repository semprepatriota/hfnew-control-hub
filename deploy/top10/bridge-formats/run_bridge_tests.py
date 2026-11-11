import importlib.util
import sys
import unittest
from pathlib import Path

stage = Path(__file__).resolve().parent
backend = Path(r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend')
sys.path.insert(0, str(backend))
sys.path.insert(0, str(stage))

import routes
import services


def load(name, path, parent=None):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    if parent is not None:
        setattr(parent, name.rsplit('.', 1)[-1], module)
    spec.loader.exec_module(module)
    return module


load('services.top10_forge_max_bridge', stage / 'top10_forge_max_bridge.py', services)
load('routes.top10', stage / 'top10.py', routes)
baseline = load('test_top10_baseline', backend / 'tests' / 'test_top10.py')
tests = load('test_bridge', stage / 'test_bridge.py')

suite = unittest.TestSuite()
for name in (
    'test_forge_max_import_survives_deleting_the_extracted_original',
    'test_forge_max_import_rejects_other_workspaces_and_duplicate_selections',
    'test_forge_max_failed_import_removes_only_the_new_project',
):
    suite.addTest(baseline.Top10Tests(name))
suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(tests))
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
