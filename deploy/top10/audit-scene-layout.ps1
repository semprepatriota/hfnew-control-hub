$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $PSScriptRoot "layout-audit-$stamp.log"
$output = "E:\HFNEW-TOP10-TOOLS\headline-verification\live-layout-$stamp.txt"
try {
    Write-Host 'Auditoria somente leitura das cenas do TOP 10 do proprietario. Nenhum projeto sera alterado.'
    $ready = Read-Host 'Pressione ENTER; a senha root sera pedida em seguida' -AsSecureString
    if ($null -ne $ready) { $ready.Dispose() }
    $source = Join-Path $PSScriptRoot '..\..\tools\audit-top10-scene-layout.py'
    $encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($source))
    $ErrorActionPreference = 'Continue'
    $lines = & ssh.exe -o ConnectTimeout=30 -o ServerAliveInterval=15 root@2.25.172.207 "echo $encoded | base64 -d | /root/ALLIANCE-DARK/backend/venv/bin/python -u" 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    $lines | Set-Content -LiteralPath $output -Encoding UTF8
    if ($code -ne 0) { $lines | Write-Host; throw "Auditoria interrompida (ssh codigo $code)." }
    Write-Host 'TOP10_LAYOUT_AUDIT=OK'
    Write-Host "RESULT=$output"
} catch { Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red }
finally { Read-Host 'Aperte ENTER para fechar' }
