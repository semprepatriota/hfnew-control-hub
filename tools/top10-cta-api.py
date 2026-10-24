"""Loopback-only, disposable preview; no production identity or storage."""
import json
import os
from pathlib import Path
import runpy
import shutil

os.environ['TOP10_BACKEND_DIR'] = r'E:\ALLIANCE DARK\ALLIANCE-DARK\backend'
os.environ['TOP10_PREVIEW_STORAGE'] = r'E:\HFNEW-TOP10-TOOLS\headline-cta\preview-storage'
loaded=runpy.run_path(str(Path(__file__).with_name('top10-local-api.py')))
app=loaded['app']
from fastapi.middleware.cors import CORSMiddleware
from services import top10_service as studio
app.add_middleware(CORSMiddleware,allow_origins=['http://127.0.0.1:4187'],allow_methods=['GET','HEAD'],allow_headers=['*'])
source=Path(r'E:\HFNEW-TOP10-TOOLS\headline-cta\render-check')
data=json.loads((source/'fixture.json').read_text(encoding='utf-8'))
context=dict(role='guest',workspace_type='personal',storage_scope='top10_local_preview',workspace_id='ws_top10_preview')
target=studio.project_root(data['id'],context)
for name in ('files','renders'):
    shutil.copytree(source/name,target/name,dirs_exist_ok=True)

@app.get('/api/qa/project')
def fixture():
    latest=json.loads((source/'fixture.json').read_text(encoding='utf-8'))
    name=latest['last_render']['filename']
    shutil.copy2(source/'renders'/name,target/'renders'/name)
    return studio.public_project(latest)

if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=9016)
