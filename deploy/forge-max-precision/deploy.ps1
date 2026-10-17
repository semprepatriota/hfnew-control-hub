$ErrorActionPreference='Stop'
$PSNativeCommandUseErrorActionPreference=$false
$root='E:\HFNEW-FORGE-MAX-PRECISION'
$archive=Join-Path $root 'forge-max-precision.tar.gz'
$hash=[IO.File]::ReadAllText((Join-Path $root 'package-sha256.txt')).Trim()
if ($hash -notmatch '^[a-f0-9]{64}$' -or !(Test-Path -LiteralPath $archive)) { throw 'Pacote de precisao incompleto.' }
$log=Join-Path $PSScriptRoot ('deploy-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
try { Start-Transcript -Path $log | Out-Null } catch {}
try {
    Write-Host 'Forge Max 3.0 - corrigir precisao SEM alterar a sensibilidade nem os outros Forge.'
    $ready=Read-Host 'Pressione ENTER para iniciar; depois digite a senha root quando pedir' -AsSecureString
    if ($null -ne $ready) { $ready.Dispose() }
    Write-Host '1/2 Enviando pacote pequeno. Digite a senha root da VPS.'
    $ErrorActionPreference='Continue'
    & scp.exe -O -o ConnectTimeout=30 -o ServerAliveInterval=15 $archive 'root@2.25.172.207:/root/forge-max-precision.tar.gz'
    $code=$LASTEXITCODE
    $ErrorActionPreference='Stop'
    if ($code -ne 0) { throw "Falha no envio (scp codigo $code). Nada foi aplicado." }
    Write-Host '2/2 Conferindo backup, producao livre e testes. Digite a senha root novamente.'
    $remote="set -eu; cd /root; echo '$hash  forge-max-precision.tar.gz' | sha256sum -c -; echo PACKAGE_SHA256=OK; STAGE=`$(mktemp -d /root/forge-max-precision-stage-XXXXXXXX); tar -xzf /root/forge-max-precision.tar.gz -C `"`$STAGE`"; /root/ALLIANCE-DARK/backend/venv/bin/python `"`$STAGE/forge-max-precision/install.py`""
    $encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remote))
    $ErrorActionPreference='Continue'
    & ssh.exe -tt -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=10 root@2.25.172.207 "echo $encoded | base64 -d | bash"
    $code=$LASTEXITCODE
    $ErrorActionPreference='Stop'
    if ($code -ne 0) { throw "Instalacao falhou (ssh codigo $code). Consulte BACKUP e ROLLBACK acima." }
    Write-Host 'Backend concluido. A interface sera publicada separadamente.' -ForegroundColor Green
} catch { Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red }
finally {
    Write-Host "LOG=$log"
    try { Stop-Transcript | Out-Null } catch {}
    Read-Host 'Aperte ENTER para fechar'
}
