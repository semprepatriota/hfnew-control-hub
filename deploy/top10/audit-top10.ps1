$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$log = Join-Path $PSScriptRoot ("audit-top10-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$remote = @'
set -eu
echo TOP10_AUDIT_BEGIN
date -u
uptime
free -m
df -h /
systemctl is-active hfnew-api || true
ps -eo pid,comm,rss --sort=-rss | head -12
echo '--- Recent memory / process failures ---'
journalctl -k --since '-20 min' --no-pager | grep -Ei 'oom|out of memory|killed process' | tail -20 || true
echo '--- Installer / owned test processes ---'
pgrep -af 'hfnew-top10-install/top10/install.py|tests/test_top10.py' || true
echo '--- Installed counter catalog ---'
cat /root/ALLIANCE-DARK/backend/assets/top10/counters/manifest.json
echo '--- API health ---'
curl --silent --show-error --max-time 10 http://127.0.0.1:9000/api/status || true
echo
echo TOP10_AUDIT=OK
'@
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remote.Replace("`r`n", "`n")))
try { Start-Transcript -Path $log | Out-Null } catch {}
try {
    Write-Host 'Auditoria somente leitura. Nenhum servico sera reiniciado.'
    $reachable = $false
    for ($attempt = 1; $attempt -le 6; $attempt++) {
        $client = New-Object Net.Sockets.TcpClient
        try {
            $pending = $client.BeginConnect('2.25.172.207', 22, $null, $null)
            if ($pending.AsyncWaitHandle.WaitOne(4000)) {
                $client.EndConnect($pending)
                $reachable = $true
                break
            }
        } catch {} finally { $client.Close() }
        Write-Host "VPS indisponivel na porta SSH. Verificacao $attempt/6."
        Start-Sleep -Seconds 5
    }
    if (!$reachable) { throw 'A VPS continua inacessivel. Nao houve nova instalacao ou reinicio.' }
    Write-Host 'Digite a senha root da VPS quando pedir.'
    $ErrorActionPreference = 'Continue'
    & ssh.exe -o ConnectTimeout=20 -o ServerAliveInterval=15 root@2.25.172.207 "echo $encoded | base64 -d | bash"
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw "Auditoria interrompida (ssh codigo $code). Nenhuma alteracao executada." }
} catch { Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red }
finally {
    Write-Host "LOG=$log"
    try { Stop-Transcript | Out-Null } catch {}
    Read-Host 'Aperte ENTER para fechar'
}
