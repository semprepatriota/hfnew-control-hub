"""No real identities, Redis, credentials or production storage are touched."""
import asyncio
from contextvars import ContextVar
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
CURRENT = ContextVar('ranking_test_scope', default={'storage_scope': 'workspace_a', 'workspace_id': 'ws_a'})
TEMP = tempfile.TemporaryDirectory()


def module(name, **values):
    result = types.ModuleType(name)
    result.__dict__.update(values)
    return result


def scoped_root(name, context=None):
    return Path(TEMP.name) / (context or CURRENT.get())['storage_scope'] / name


def write_atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding='utf-8')


STUBS = {
    'config': module('config', settings=types.SimpleNamespace(SECRET_KEY='test-only-not-a-real-secret')),
    'utils': module('utils'),
    'utils.user_context': module('utils.user_context', get_current_user_context=CURRENT.get, set_current_user=CURRENT.set, reset_current_user=CURRENT.reset),
    'utils.workspace_storage': module('utils.workspace_storage', workspace_module_root=scoped_root,
                                     workspace_storage_scope=lambda: CURRENT.get()['storage_scope'], write_json_atomic=write_atomic),
}
with patch.dict(sys.modules, STUBS):
    spec = importlib.util.spec_from_file_location('ranking_test_service', HERE / 'backend/services/ranking_service.py')
    studio = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(studio)


class RankingTests(unittest.TestCase):
    def setUp(self):
        CURRENT.set({'storage_scope': 'workspace_a', 'workspace_id': 'ws_a'})
        self.asset = dict(id='a'*32, filename='a'*32+'.mp4', name='scene', frames=60, width=720, height=1280, kind='scene')
        self.catalog = {self.asset['id']: self.asset}
        self.clip = dict(assetId=self.asset['id'], startFrame=0, endFrame=60, volume=.8, x=.5, y=.5, zoom=1, fit='cover')
        self.project = studio.preset('classic')
        self.project['items'] = [dict(id='item1', label='scene1', clips=[self.clip], interlude=None)]

    def test_empty_templates_are_private_and_do_not_copy_pilot_data(self):
        state = studio.state()
        self.assertEqual(state['presets']['classic']['items'], [])
        self.assertNotIn('E:', json.dumps(state))

    def test_workspace_isolation(self):
        path = studio.root()
        token = CURRENT.set({'storage_scope': 'workspace_b', 'workspace_id': 'ws_b'})
        try:
            self.assertNotEqual(path, studio.root())
            self.assertEqual(studio.assets(), {})
        finally:
            CURRENT.reset(token)

    def test_valid_project_and_normalization(self):
        result = studio.validate_project(self.project, self.catalog)
        self.assertEqual(result['items'][0]['clips'][0]['endFrame'], 60)
        self.assertIsNot(result, self.project)

    def test_missing_or_cross_workspace_asset(self):
        with self.assertRaises(Exception):
            studio.validate_project(self.project, {})

    def test_frames_must_be_integer_and_within_file(self):
        for end in (61, -1, .5, True):
            self.clip['endFrame'] = end
            with self.assertRaises(Exception):
                studio.validate_project(self.project, self.catalog)

    def test_limit_three_minutes(self):
        self.catalog[self.asset['id']]['frames'] = 5401
        self.clip['endFrame'] = 5401
        with self.assertRaises(Exception):
            studio.validate_project(self.project, self.catalog)

    def test_duplicate_scene_and_eleven_positions_rejected(self):
        self.project['items'] *= 2
        with self.assertRaises(Exception):
            studio.validate_project(self.project, self.catalog)
        self.project['items'] *= 6
        with self.assertRaises(Exception):
            studio.validate_project(self.project, self.catalog)

    def test_media_requires_unexpired_matching_signature(self):
        from urllib.parse import urlparse, parse_qs
        file = studio.root() / 'media' / self.asset['filename']
        file.write_bytes(b'video')
        url = studio.media_url('media', file.name)
        query = {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}
        query['expires'] = int(query['expires'])
        self.assertEqual(studio.resolve_media('media', file.name, **query), file.resolve())
        for bad in ({'scope': 'workspace_b'}, {'expires': 1}, {'sig': 'bad'}):
            with self.assertRaises(Exception):
                studio.resolve_media('media', file.name, **(query | bad))

    def test_traversal_rejected(self):
        for name in ('../secret.mp4', 'anything.mp4', '/etc/passwd'):
            with self.assertRaises(Exception):
                studio.checked_file(studio.root() / 'media', name)

    def test_audio_cannot_be_used_as_video(self):
        self.asset['width'] = 0
        with self.assertRaises(Exception):
            studio.validate_project(self.project, self.catalog)

    def test_nginx_changes_only_api_blocks_and_is_idempotent(self):
        spec = importlib.util.spec_from_file_location('ranking_installer_test', HERE / 'install.py')
        installer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(installer)
        before = '''server {
    server_name jesus.hfnew.com.br;
    location / { proxy_pass http://127.0.0.1:4188; }
}
server {
    server_name api.hfnew.com.br;
    location / { proxy_pass http://127.0.0.1:9000; }
}
'''
        after, count = installer.nginx_add(before)
        self.assertEqual(count, 1)
        self.assertEqual(after.split('server {')[1], before.split('server {')[1])
        self.assertEqual(installer.nginx_add(after), (after, 0))


class HttpTests(unittest.IsolatedAsyncioTestCase):
    async def test_auth_and_workspace_resolution(self):
        import httpx
        from fastapi import HTTPException
        def resolve(path, method, token):
            if token != 'Bearer test-session':
                raise HTTPException(401, 'Autenticacao ausente')
            self.assertTrue(path.startswith('/api/forge/'))
            return {'storage_scope': 'workspace_a', 'workspace_id': 'ws_a'}
        from fastapi import APIRouter
        router = APIRouter()
        @router.get('/api/ranking/state')
        def state():
            return {'workspace_id': CURRENT.get()['workspace_id']}
        mocks = STUBS | {
            'utils.request_auth': module('utils.request_auth', resolve_request_user_context=resolve),
            'services.billing_store': module('services.billing_store', reserve_request_usage=lambda *a, **kw: None,
                                             finalize_request_usage=lambda *a, **kw: None, BillingAccessDenied=type('BillingAccessDenied', (Exception,), {}),
                                             BillingLimitExceeded=type('BillingLimitExceeded', (Exception,), {})),
            'routes': module('routes'), 'routes.ranking': module('routes.ranking', router=router),
        }
        with patch.dict(sys.modules, mocks):
            spec = importlib.util.spec_from_file_location('ranking_app_test', HERE / 'renderer/ranking_app.py')
            app = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(app)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app.app), base_url='http://test') as client:
            self.assertEqual((await client.get('/api/ranking/state')).status_code, 401)
            response = await client.get('/api/ranking/state', headers={'Authorization': 'Bearer test-session'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['workspace_id'], 'ws_a')
            response = await client.options('/api/ranking/state', headers={'Origin': 'https://app.hfnew.com.br', 'Access-Control-Request-Method': 'GET'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['access-control-allow-origin'], 'https://app.hfnew.com.br')


if __name__ == '__main__':
    unittest.main(verbosity=2)
