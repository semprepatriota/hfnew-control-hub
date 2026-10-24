$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$archive = 'E:\HFNEW-PILOTOS\ranking-multimidia\ranking-production.tar.gz'
$log = Join-Path $PSScriptRoot ('deploy-ranking-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
try { Start-Transcript -Path $log | Out-Null } catch {}
try {
    $Host.UI.RawUI.WindowTitle = 'HF HUB - publicar Ranking Multimidia'
    if (!(Test-Path -LiteralPath $archive)) { throw 'Pacote local nao encontrado.' }
    Write-Host '1/2 Enviar novo editor. Digite a senha da VPS quando o SSH pedir.'
    Write-Host 'Nao sera criado backup extra e a API dos outros Forge nao sera reiniciada.'
    $ErrorActionPreference = 'Continue'
    & scp.exe -O -o ConnectTimeout=30 -o ServerAliveInterval=15 $archive 'root@2.25.172.207:/root/hfnew-ranking-production.tar.gz'
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw "Envio falhou (codigo $code). Nada foi ativado." }
    Write-Host '2/2 Instalar, testar os dois MP4 e ativar o servico isolado. Digite a senha root novamente.'
    $ErrorActionPreference = 'Continue'
    & ssh.exe -tt -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=20 root@2.25.172.207 'mkdir -p /root/hfnew-ranking-install && tar -xzf /root/hfnew-ranking-production.tar.gz -C /root/hfnew-ranking-install && /root/ALLIANCE-DARK/backend/venv/bin/python /root/hfnew-ranking-install/install.py'
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw "Instalacao falhou (codigo $code). O frontend ainda nao foi publicado." }
    Write-Host 'RANKING_DEPLOY=OK' -ForegroundColor Green
} catch {
    Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red
} finally {
    Write-Host "LOG=$log"
    try { Stop-Transcript | Out-Null } catch {}
    Read-Host 'Aperte ENTER para fechar'
}
