$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$archive='E:\HFNEW-TOP10-TOOLS\headline-cta\top10-headline-cta.tar.gz'
$log=Join-Path $PSScriptRoot ('deploy-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
try { Start-Transcript -Path $log | Out-Null } catch {}
try {
    $Host.UI.RawUI.WindowTitle='TOP 10 - headline e inscreva-se + joinha'
    Write-Host '1/2 Enviar ajuste somente do TOP 10. Digite a senha root quando o SSH pedir.'
    $ErrorActionPreference='Continue'
    & scp.exe -O -o ConnectTimeout=30 -o ServerAliveInterval=15 $archive 'root@2.25.172.207:/root/top10-headline-cta.tar.gz'
    $code=$LASTEXITCODE
    $ErrorActionPreference='Stop'
    if($code -ne 0){throw "Envio falhou (codigo $code). Nada aplicado."}
    Write-Host '2/2 Testar MP4, preservar os outros modulos e aplicar. Digite a senha root novamente.'
    $ErrorActionPreference='Continue'
    & ssh.exe -tt -o ConnectTimeout=30 -o ServerAliveInterval=15 root@2.25.172.207 'mkdir -p /root/top10-headline-cta-install && tar -xzf /root/top10-headline-cta.tar.gz -C /root/top10-headline-cta-install && /root/ALLIANCE-DARK/backend/venv/bin/python /root/top10-headline-cta-install/install.py'
    $code=$LASTEXITCODE
    $ErrorActionPreference='Stop'
    if($code -ne 0){throw "Aplicacao falhou (codigo $code). Verifique o erro e ROLLBACK acima."}
    Write-Host 'TOP10_HEADLINE_CTA_DEPLOY=OK' -ForegroundColor Green
} catch { Write-Host ('ERRO: '+$_.Exception.Message) -ForegroundColor Red }
finally {
    try {Stop-Transcript | Out-Null} catch {}
    Write-Host "LOG=$log"
    Read-Host 'Aperte ENTER para fechar'
}
