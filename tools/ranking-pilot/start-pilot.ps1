$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$data='E:\HFNEW-PILOTOS\ranking-multimidia\data'
$url='http://127.0.0.1:4182/tools/ranking-pilot/index.html'
try {
    $existing=Invoke-RestMethod -Uri 'http://127.0.0.1:4182/api/pilot/state' -TimeoutSec 2
    if ($existing.presets.classic -and $existing.presets.interludes) { Write-Host "PILOTO=$url"; return }
} catch {}
if (!(Test-Path -LiteralPath (Join-Path $data 'presets.json'))) { throw 'As midias do piloto ainda nao foram preparadas.' }
$node=(Get-Command node).Source
$vite=Join-Path $repo 'node_modules\vite\bin\vite.js'
$config=Join-Path $PSScriptRoot 'vite.config.mjs'
Start-Process -FilePath $node -ArgumentList @(('"'+$vite+'"'),'--config',('"'+$config+'"')) -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $data 'dev-server.log') -RedirectStandardError (Join-Path $data 'dev-server-error.log') | Out-Null
Write-Host "PILOTO=$url"
