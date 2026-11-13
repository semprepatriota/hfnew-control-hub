$ErrorActionPreference = 'Stop'
$stage = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = 'E:\ALLIANCE DARK\ALLIANCE-DARK\backend'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $stage "publish-top3-$stamp.log"
$release = Join-Path $stage 'release'
$archive = Join-Path $stage 'top3-release.tar.gz'
$files = @('services/top10_service.py')

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
    New-Item -ItemType Directory -Force -Path $release | Out-Null
    $manifest = @{}
    foreach ($file in $files) {
        $source = Join-Path $stage ("backend/" + $file)
        if (!(Test-Path -LiteralPath $source)) {
            $source = Join-Path $stage ("backend/" + (Split-Path -Leaf $file))
        }
        $original = Join-Path $backend $file
        $target = Join-Path $release ("backend/" + $file)
        if (!(Test-Path -LiteralPath $original)) { throw "Backend local nao encontrado: $file" }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
        Copy-Item -LiteralPath $source -Destination $target -Force
        $expected = Get-Content -Raw -LiteralPath (Join-Path $stage 'manifest.json') | ConvertFrom-Json
        $oldHash = $expected.PSObject.Properties[$file].Value.old
        if ($oldHash -notmatch '^[a-f0-9]{64}$') { throw 'Hash de baseline invalido' }
        $manifest[$file] = @{ old = $oldHash; new = (Sha256 $target) }
    }
    $json = ConvertTo-Json -InputObject $manifest -Depth 3
    [System.IO.File]::WriteAllText((Join-Path $release 'manifest.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
    Copy-Item -LiteralPath (Join-Path $stage 'deploy_top3.py') -Destination (Join-Path $release 'deploy_top3.py') -Force
    & tar.exe -czf $archive -C $release 'backend/services/top10_service.py' 'manifest.json' 'deploy_top3.py'
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar pacote TOP 3' }
    Write-Host '1/1 Publicando extra de uma cena no TOP 3. Digite a senha root quando o SSH pedir.'
    $encoded = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($archive))
    $remote = "echo $encoded | base64 -d > /root/hfnew-top3-release.tar.gz && mkdir -p /root/hfnew-top3-release && tar -xzf /root/hfnew-top3-release.tar.gz -C /root/hfnew-top3-release && /root/ALLIANCE-DARK/backend/venv/bin/python /root/hfnew-top3-release/deploy_top3.py"
    $ErrorActionPreference = 'Continue'
    & ssh.exe -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=10 root@2.25.172.207 $remote
    $applied = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($applied -ne 0) { throw "Falha ao aplicar (ssh codigo $applied). Leia ROLLBACK acima." }
    Write-Host 'TOP3_SINGLE_EXTRA_DEPLOY=OK' -ForegroundColor Green
} catch {
    Write-Host "ERRO=$($_.Exception.Message)" -ForegroundColor Red
} finally {
    Write-Host "LOG=$log"
    try { Stop-Transcript | Out-Null } catch {}
    Read-Host 'Aperte ENTER para fechar'
}
