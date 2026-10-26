"""Loopback QA using synthetic scenes only, never a production session."""
import json
import os
from pathlib import Path
import runpy
import shutil

os.environ['TOP10_BACKEND_DIR']=r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend'
os.environ['TOP10_PREVIEW_STORAGE']=r'E:\HFNEW-TOP10-TOOLS\no-counters\preview-storage'
loaded=runpy.run_path(str(Path(__file__).with_name('top10-local-api.py')))
app=loaded['app']
from fastapi.middleware.cors import CORSMiddleware
from services import top10_service as studio
from utils.user_context import set_current_user,reset_current_user

app.add_middleware(CORSMiddleware,allow_origins=['http://127.0.0.1:4187'],allow_methods=['*'],allow_headers=['*'])
source=Path(r'E:\HFNEW-TOP10-TOOLS\no-counters\render-check')
data=json.loads((source/'fixture.json').read_text(encoding='utf-8'))
data.update(created_at=studio._now(),job=None)
context=dict(role='guest',workspace_type='personal',storage_scope='top10_local_preview',workspace_id='ws_top10_preview')
token=set_current_user(context)
try:
    target=studio.project_root(data['id'])
    for name in ('files','renders','jobs'):
        shutil.copytree(source/name,target/name,dirs_exist_ok=True)
    studio._write(data)
finally:
    reset_current_user(token)

if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=9017,timeout_graceful_shutdown=2)
