param([switch]$ValidateOnly)
$ErrorActionPreference='Stop'
$PSNativeCommandUseErrorActionPreference=$false
$Host.UI.RawUI.WindowTitle='TOP 10 - logo redonda - uma senha'
$archive='E:\HFNEW-TOP10-TOOLS\round-logo\top10-logo-round.tar.gz'
$log=Join-Path $PSScriptRoot ('single-connection-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
try { Start-Transcript -Path $log | Out-Null } catch {}
try {
    if (!(Test-Path -LiteralPath $archive)) { throw 'Pacote local nao encontrado.' }
    $bytes=[IO.File]::ReadAllBytes($archive)
    $sha=[Security.Cryptography.SHA256]::Create()
    try { $hash=[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
    $expected=[IO.File]::ReadAllText('E:\HFNEW-TOP10-TOOLS\round-logo\package-sha256.txt').Trim()
    if ($hash -ne $expected) { throw 'Hash local diferente do pacote testado. Nada sera enviado.' }
    $payload=[Convert]::ToBase64String($bytes)
    $remote=@'
set -eu
stage=$(mktemp -d /root/top10-round-single-XXXXXXXX)
printf '%s' '__PAYLOAD__' | base64 -d > "$stage/package.tar.gz"
printf '%s  %s\n' '__HASH__' "$stage/package.tar.gz" | sha256sum -c -
tar -xzf "$stage/package.tar.gz" -C "$stage"
/root/ALLIANCE-DARK/backend/venv/bin/python -u "$stage/install.py"
'@
    $remote=$remote.Replace('__PAYLOAD__',$payload).Replace('__HASH__',$hash).Replace("`r`n","`n")
    $encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remote))
    $command="echo $encoded | base64 -d | bash"
    if ($command.Length -gt 29000) { throw 'O pacote excede o limite seguro desta conexao. Nada foi enviado.' }
    if ($ValidateOnly) {
        Write-Host "PACKAGE_VALIDATION=OK`nSSH_COMMAND_CHARS=$($command.Length)`nNOTHING_SENT=true"
        return
    }
    Write-Host 'TOP 10: envio e instalacao pela mesma conexao; sem SCP.'
    Write-Host 'Digite a senha root da VPS somente quando o SSH pedir. Uma solicitacao.'
    Write-Host 'Os Forge em processamento serao preservados. Backup e rollback continuam ativos.'
    $ErrorActionPreference='Continue'
    & ssh.exe -tt -o ConnectTimeout=30 -o ServerAliveInterval=10 -o ServerAliveCountMax=12 -o 'PreferredAuthentications=password,keyboard-interactive' -o PubkeyAuthentication=no root@2.25.172.207 $command
    $code=$LASTEXITCODE
    $ErrorActionPreference='Stop'
    if ($code -ne 0) { throw "Publicacao interrompida (ssh codigo $code). Consulte o erro acima." }
    Write-Host 'Backend aplicado. Aguarde a publicacao da interface.' -ForegroundColor Green
} catch { Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red }
finally {
    Write-Host "LOG=$log"
    try { Stop-Transcript | Out-Null } catch {}
    if (!$ValidateOnly) { Read-Host 'Aperte ENTER para fechar' }
}
