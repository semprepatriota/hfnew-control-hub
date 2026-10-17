$ErrorActionPreference='Stop'
$PSNativeCommandUseErrorActionPreference=$false
$Host.UI.RawUI.WindowTitle='TOP 10 - diminuir caixa branca da headline'
$archive='E:\HFNEW-TOP10-TOOLS\compact-headline\top10-compact-headline.tar.gz'
$hash=[IO.File]::ReadAllText('E:\HFNEW-TOP10-TOOLS\compact-headline\package-sha256.txt').Trim()
$log=Join-Path $PSScriptRoot ('deploy-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
try { Start-Transcript -Path $log | Out-Null } catch {}
try {
    if ($hash -notmatch '^[a-f0-9]{64}$' -or !(Test-Path -LiteralPath $archive)) { throw 'Pacote nao encontrado ou invalido.' }
    Write-Host 'TOP 10: reduzir somente o fundo branco, sem mudar letras ou os outros Forge.'
    Write-Host 'Digite a senha root da VPS quando o SSH pedir. A senha nao aparece na tela.'
    Write-Host '1/2 Enviando pacote pequeno.'
    $ErrorActionPreference='Continue'
    & scp.exe -O -o ConnectTimeout=30 -o ServerAliveInterval=15 $archive 'root@2.25.172.207:/root/top10-compact-headline.tar.gz'
    $code=$LASTEXITCODE
    $ErrorActionPreference='Stop'
    if ($code -ne 0) { throw "Falha no envio (scp codigo $code). Nada foi aplicado." }
    Write-Host '2/2 Aplicando com backup, testes e protecao de render ativo. Digite a senha root novamente.'
    $remote="set -eu; cd /root; echo '$hash  top10-compact-headline.tar.gz' | sha256sum -c -; STAGE=`$(mktemp -d /root/top10-compact-stage-XXXXXXXX); tar -xzf /root/top10-compact-headline.tar.gz -C `"`$STAGE`"; /root/ALLIANCE-DARK/backend/venv/bin/python `"`$STAGE/install.py`""
    $encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remote))
    $ErrorActionPreference='Continue'
    & ssh.exe -tt -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=10 root@2.25.172.207 "echo $encoded | base64 -d | bash"
    $code=$LASTEXITCODE
    $ErrorActionPreference='Stop'
    if ($code -ne 0) { throw "Aplicacao falhou (ssh codigo $code). Consulte o erro acima." }
    Write-Host 'Backend aplicado. A interface sera publicada apos a confirmacao.' -ForegroundColor Green
} catch { Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red }
finally {
    Write-Host "LOG=$log"
    try { Stop-Transcript | Out-Null } catch {}
    Read-Host 'Aperte ENTER para fechar'
}
