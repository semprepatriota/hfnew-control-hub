$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$log = Join-Path $PSScriptRoot ("resume-top10-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$remote = @'
import os
from pathlib import Path
import subprocess
import sys
import time
from redis import Redis

root = Path('/root/ALLIANCE-DARK/backend')
installer = Path('/root/hfnew-top10-install/top10/install.py')
if not installer.is_file() or '"TOP10_SKIP_MEDIA_TEST": "1"' not in installer.read_text():
    raise SystemExit('O instalador leve esperado nao esta na VPS. Nenhuma alteracao executada.')
redis = Redis.from_url(os.getenv('HFNEW_REDIS_URL', 'redis://127.0.0.1:6379/0'), socket_timeout=3)
key = 'hfnew:render:capacity'
deadline = time.monotonic() + 180
while redis.exists(key):
    ttl = redis.ttl(key)
    print(f'RENDER_CAPACITY_WAIT: reserva ocupada; expiracao em {ttl}s. Nenhuma trava sera removida.', flush=True)
    if ttl == -1 or time.monotonic() > deadline:
        raise SystemExit('A reserva continua ocupada. Nada foi aplicado; requer verificacao do processamento ativo.')
    time.sleep(10)
print('RENDER_CAPACITY_AVAILABLE=OK', flush=True)
result = subprocess.run([str(root / 'venv/bin/python'), '-u', str(installer)], cwd=root, stderr=subprocess.STDOUT)
if result.returncode:
    raise SystemExit(result.returncode)
print('TOP10_DEPLOY=OK', flush=True)
'@
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remote.Replace("`r`n", "`n")))
Write-Host 'Retomar TOP 10 com o pacote ja enviado. Somente uma senha da VPS.'
Write-Host 'A reserva dos Forge sera respeitada; nao havera teste pesado de render.'
try {
    $ErrorActionPreference = 'Continue'
    & ssh.exe -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=10 root@2.25.172.207 "echo $encoded | base64 -d | /root/ALLIANCE-DARK/backend/venv/bin/python -u" 2>&1 | Tee-Object -FilePath $log
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw "Retomada interrompida (ssh codigo $code). Consulte o log." }
} catch { Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red }
finally { Write-Host "LOG=$log"; Read-Host 'Aperte ENTER para fechar' }
