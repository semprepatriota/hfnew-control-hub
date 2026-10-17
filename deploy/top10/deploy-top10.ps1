$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$archive = 'E:\HFNEW-TOP10-TOOLS\top10-backend.tar.gz'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $PSScriptRoot "deploy-top10-$stamp.log"
if (!(Test-Path -LiteralPath $archive)) { throw 'O pacote TOP 10 nao foi encontrado.' }
try { Start-Transcript -Path $log | Out-Null } catch { Write-Host "Log nao disponivel: $log" }
try {
    Write-Host '1/3 Enviando TOP 10. Digite a senha root da VPS quando pedir.'
    $ErrorActionPreference = 'Continue'
    & scp.exe -O -o ConnectTimeout=30 -o ServerAliveInterval=15 $archive 'root@2.25.172.207:/root/hfnew-top10-backend.tar.gz'
    $sendCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($sendCode -ne 0) { throw "Falha no envio (scp codigo $sendCode). Nada foi aplicado." }
    Write-Host '2/3 Aplicando com backup, teste de MP4 e protecao dos Forge. Digite a senha root novamente.'
    $ErrorActionPreference = 'Continue'
    & ssh.exe -tt -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=10 root@2.25.172.207 'mkdir -p /root/hfnew-top10-install && tar -xzf /root/hfnew-top10-backend.tar.gz -C /root/hfnew-top10-install && /root/ALLIANCE-DARK/backend/venv/bin/python /root/hfnew-top10-install/top10/install.py'
    $applyCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($applyCode -ne 0) { throw "Instalacao falhou (ssh codigo $applyCode). Consulte o erro e ROLLBACK acima." }
    Write-Host '3/3 TOP10_DEPLOY=OK. Backend aplicado. O frontend sera publicado em seguida.'
} catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Write-Host "LOG=$log"
    try { Stop-Transcript | Out-Null } catch {}
    Read-Host 'Aperte ENTER para fechar'
}
