$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$archive = 'E:\HFNEW-TOP10-TOOLS\top10-counter3.tar.gz'
$log = Join-Path $PSScriptRoot ('counter3-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
try {
    if (!(Test-Path -LiteralPath $archive)) { throw 'Pacote corrigido nao encontrado.' }
    Write-Host '1/2 Enviando somente a correcao do contador 3. Digite a senha root.'
    $ErrorActionPreference = 'Continue'
    & scp.exe -O -o ConnectTimeout=30 -o ServerAliveInterval=15 $archive root@2.25.172.207:/root/top10-counter3.tar.gz
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw "Envio falhou (scp codigo $code). Nada foi aplicado." }
    Write-Host '2/2 Substituindo com backup, sem reiniciar a API. Digite a senha root novamente.'
    $ErrorActionPreference = 'Continue'
    & ssh.exe -o ConnectTimeout=30 -o ServerAliveInterval=15 root@2.25.172.207 'mkdir -p /root/top10-counter3-update && tar -xzf /root/top10-counter3.tar.gz -C /root/top10-counter3-update && /root/ALLIANCE-DARK/backend/venv/bin/python -u /root/top10-counter3-update/counter3/update-counter3.py 2>&1' | Tee-Object -FilePath $log
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw "Troca interrompida (ssh codigo $code). Consulte o log." }
} catch { Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red }
finally { Write-Host "LOG=$log"; Read-Host 'Aperte ENTER para fechar' }
