$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$destination = 'E:\HFNEW-TOP10-TOOLS\headline-cta\live'
$script = Join-Path $PSScriptRoot 'audit_remote.py'
$log = Join-Path $PSScriptRoot ('audit-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
try { Start-Transcript -Path $log | Out-Null } catch {}
try {
    $Host.UI.RawUI.WindowTitle = 'TOP 10 - conferir headline e CTA - somente leitura'
    Write-Host 'Digite a senha root da VPS quando pedir. Esta etapa nao altera nenhum aplicativo.'
    $encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($script))
    $remote = "echo $encoded | base64 -d | python3"
    $ErrorActionPreference = 'Continue'
    $output = & ssh.exe -o ConnectTimeout=30 -o ServerAliveInterval=15 root@2.25.172.207 $remote 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    $rows = @($output | ForEach-Object { $_.ToString() })
    $rows | Where-Object { !$_.StartsWith('TOP10_CTA_AUDIT_JSON=') } | ForEach-Object { Write-Host $_ }
    if ($code -ne 0) { throw "Auditoria falhou (ssh codigo $code). Nenhuma alteracao feita." }
    $line = $rows | Where-Object { $_.StartsWith('TOP10_CTA_AUDIT_JSON=') } | Select-Object -Last 1
    if (!$line) { throw 'Relatorio nao recebido' }
    $report = $line.Substring('TOP10_CTA_AUDIT_JSON='.Length) | ConvertFrom-Json
    [IO.Directory]::CreateDirectory($destination) | Out-Null
    foreach ($entry in $report.files.PSObject.Properties) {
        $relative = $entry.Name.Replace('/', [IO.Path]::DirectorySeparatorChar)
        $target = [IO.Path]::GetFullPath((Join-Path $destination $relative))
        if (!$target.StartsWith($destination + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Destino invalido' }
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
        $bytes = [Convert]::FromBase64String($entry.Value.data)
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $digest = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
        if ($digest -ne $entry.Value.sha256) { throw 'Falha na integridade do arquivo' }
        [IO.File]::WriteAllBytes($target, $bytes)
    }
    [IO.File]::WriteAllText((Join-Path $destination 'report.json'), ($report | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
    Write-Host 'TOP10_CTA_AUDIT=OK' -ForegroundColor Green
} catch {
    Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red
} finally {
    try { Stop-Transcript | Out-Null } catch {}
    Write-Host "LOG=$log"
    Read-Host 'Aperte ENTER para fechar'
}
