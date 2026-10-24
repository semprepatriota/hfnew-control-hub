"""Isolated HTTP process: reuse HUB identity/billing without restarting its API."""
import asyncio
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from services.billing_store import reserve_request_usage, finalize_request_usage, BillingAccessDenied, BillingLimitExceeded
from utils.request_auth import resolve_request_user_context
from utils.user_context import set_current_user, reset_current_user
from routes.ranking import router

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware('http')
async def workspace_auth(request: Request, call_next):
    path = request.url.path
    if request.method == 'OPTIONS':
        return await call_next(request)
    public = request.method in ('GET', 'HEAD') and (path == '/api/ranking/font' or path.startswith('/api/ranking/media/'))
    if public:
        return await call_next(request)  # Each media route still verifies its signed capability.
    mapped = '/api/forge/render' if path == '/api/ranking/render' else '/api/forge/ranking'
    reservation = None
    token = None
    try:
        context = await asyncio.to_thread(resolve_request_user_context, mapped, request.method, request.headers.get('authorization'))
        if not context or not context.get('workspace_id'):
            raise HTTPException(401, 'Autenticacao ausente')
        length = int(request.headers.get('content-length', '0'))
        maximum = 200 * 1024**2 if path == '/api/ranking/upload' else 2 * 1024**2
        if length < 0 or length > maximum:
            raise HTTPException(413, 'Requisicao excede o limite permitido')
        if path == '/api/ranking/render' and request.method == 'POST':
            reservation = await asyncio.to_thread(reserve_request_usage, context, mapped, request.method,
                                                  idempotency_key=f'ranking:{uuid.uuid4().hex}')
        token = set_current_user(context)
        response = await call_next(request)
        if reservation:
            await asyncio.to_thread(finalize_request_usage, reservation, success=response.status_code < 400, response_status=response.status_code)
        return response
    except HTTPException as exc:
        return JSONResponse({'detail': exc.detail}, status_code=exc.status_code)
    except (BillingAccessDenied, BillingLimitExceeded) as exc:
        return JSONResponse({'detail': str(exc)}, status_code=429 if isinstance(exc, BillingLimitExceeded) else 402)
    except Exception:
        if reservation:
            await asyncio.to_thread(finalize_request_usage, reservation, success=False, response_status=500)
        return JSONResponse({'detail': 'Falha no editor. O projeto foi preservado.'}, status_code=500)
    finally:
        if token is not None:
            reset_current_user(token)


app.add_middleware(CORSMiddleware, allow_origins=['https://app.hfnew.com.br', 'http://127.0.0.1:4183'],
                   allow_credentials=False, allow_methods=['GET', 'HEAD', 'POST', 'OPTIONS'],
                   allow_headers=['Authorization', 'Content-Type', 'Range', 'X-Request-ID'],
                   expose_headers=['Content-Disposition', 'Content-Range', 'Accept-Ranges', 'Content-Length'])
app.include_router(router)
