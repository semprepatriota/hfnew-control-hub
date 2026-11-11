$ErrorActionPreference = 'Stop'
$stage = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = 'E:\ALLIANCE DARK\ALLIANCE-DARK\backend'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $stage "publish-top10-bridge-$stamp.log"
$release = Join-Path $stage 'release'
$archive = Join-Path $stage 'top10-bridge-release.tar.gz'

function Sha256($path) {
    $hash = [System.Security.Cryptography.SHA256]::Create()
    try {
        $stream = [System.IO.File]::OpenRead($path)
        try { return [System.BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
        finally { $stream.Dispose() }
    } finally { $hash.Dispose() }
}

try { Start-Transcript -Path $log | Out-Null } catch { Write-Host "LOG_INDISPONIVEL=$log" }
try {
    $manifest = @{}
    foreach ($pair in @(@('routes/top10.py', 'top10.py'), @('services/top10_forge_max_bridge.py', 'top10_forge_max_bridge.py'))) {
        $relative = $pair[0]
        $source = Join-Path $stage $pair[1]
        $original = Join-Path $backend $relative
        $target = Join-Path $release ("backend/" + $relative)
        if (!(Test-Path -LiteralPath $source) -or !(Test-Path -LiteralPath $original)) { throw "Arquivo ausente: $relative" }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
        Copy-Item -LiteralPath $source -Destination $target -Force
        $manifest[$relative] = @{ old = (Sha256 $original); new = (Sha256 $target) }
    }
    [IO.File]::WriteAllText((Join-Path $release 'manifest.json'), (ConvertTo-Json -InputObject $manifest -Depth 3), (New-Object Text.UTF8Encoding($false)))
    Copy-Item -LiteralPath (Join-Path $stage 'install.py') -Destination (Join-Path $release 'install.py') -Force
    & tar.exe -czf $archive -C $release 'backend' 'manifest.json' 'install.py'
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar pacote da ponte' }
    $encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($archive))
    if ($encoded.Length -ge 30000) { throw 'Pacote grande demais para envio em uma conexao SSH' }
    Write-Host 'Publicando ponte Forge Max para TOP 10, TOP 5 e TOP 3. Digite a senha root uma vez.'
    $remote = "echo $encoded | base64 -d > /root/hfnew-top10-bridge-release.tar.gz && mkdir -p /root/hfnew-top10-bridge-release && tar -xzf /root/hfnew-top10-bridge-release.tar.gz -C /root/hfnew-top10-bridge-release && /root/ALLIANCE-DARK/backend/venv/bin/python /root/hfnew-top10-bridge-release/install.py"
    $ErrorActionPreference = 'Continue'
    & ssh.exe -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=10 root@2.25.172.207 $remote
    $applied = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($applied -ne 0) { throw "Falha ao aplicar (ssh codigo $applied). Consulte ROLLBACK acima." }
    Write-Host 'TOP10_BRIDGE_DEPLOY=OK' -ForegroundColor Green
} catch {
    Write-Host "ERRO=$($_.Exception.Message)" -ForegroundColor Red
} finally {
    Write-Host "LOG=$log"
    try { Stop-Transcript | Out-Null } catch {}
    Read-Host 'Aperte ENTER para fechar'
}
