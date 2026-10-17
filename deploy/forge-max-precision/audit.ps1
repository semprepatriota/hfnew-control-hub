$ErrorActionPreference='Stop'
$PSNativeCommandUseErrorActionPreference=$false
$destination=Join-Path 'E:\HFNEW-FORGE-MAX-PRECISION' (Get-Date -Format 'yyyyMMdd-HHmmss')
New-Item -ItemType Directory -Path $destination -Force | Out-Null
try {
    Write-Host 'Forge Max 3.0 - auditoria SOMENTE LEITURA. Nao reinicia nem altera a API.'
    $ready=Read-Host 'Pressione ENTER para iniciar' -AsSecureString
    if ($null -ne $ready) { $ready.Dispose() }
    $encoded=[Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'audit.py')))
    $ErrorActionPreference='Continue'
    $output=& ssh.exe -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=10 root@2.25.172.207 "echo $encoded | base64 -d | /root/ALLIANCE-DARK/backend/venv/bin/python -" 2>&1
    $code=$LASTEXITCODE
    $ErrorActionPreference='Stop'
    $lines=@($output | ForEach-Object { $_.ToString() })
    if ($code -ne 0) { $lines | Select-Object -Last 12 | Write-Host; throw "Auditoria falhou (ssh codigo $code). Nenhuma alteracao aplicada." }
    $record=$lines | Where-Object { $_.StartsWith('MAX_PRECISION_JSON=') } | Select-Object -Last 1
    if (!$record) { throw 'Resposta de auditoria incompleta.' }
    $json=$record.Substring('MAX_PRECISION_JSON='.Length)
    [IO.File]::WriteAllText((Join-Path $destination 'audit.json'),$json,(New-Object Text.UTF8Encoding($false)))
    $data=$json | ConvertFrom-Json
    foreach ($entry in $data.files.PSObject.Properties) {
        $target=Join-Path $destination $entry.Name
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
        [IO.File]::WriteAllBytes($target,[Convert]::FromBase64String($entry.Value.content))
    }
    Write-Host 'MAX_PRECISION_AUDIT=OK' -ForegroundColor Green
    Write-Host "RESULT=$destination"
} catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
} finally { Read-Host 'Aperte ENTER para fechar' }
