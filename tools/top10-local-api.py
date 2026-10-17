"""Loopback-only developer preview with isolated disposable data."""
import os
import sys
from pathlib import Path

backend = Path(os.environ["TOP10_BACKEND_DIR"]).resolve()
sys.path.insert(0, str(backend))
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routes.top10 import router
from utils.user_context import reset_current_user, set_current_user

settings.STORAGE_DIR = str(Path(os.environ["TOP10_PREVIEW_STORAGE"]).resolve())
settings.SECRET_KEY = "local-top10-preview-separate-from-production"
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["http://127.0.0.1:5184", "http://localhost:5184"], allow_methods=["*"], allow_headers=["*"], expose_headers=["Content-Length", "Content-Range"])

@app.middleware("http")
async def preview_context(request, call_next):
    token = set_current_user({"role": "guest", "workspace_type": "personal", "storage_scope": "top10_local_preview", "workspace_id": "ws_top10_preview"})
    try:
        return await call_next(request)
    finally:
        reset_current_user(token)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=9014)
