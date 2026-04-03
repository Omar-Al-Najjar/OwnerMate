$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendDir = Join-Path $repoRoot "backend"
$envFile = Join-Path $backendDir ".env.supabase"

if (-not (Test-Path -LiteralPath $envFile)) {
    Write-Error "Missing backend/.env.supabase. Create it from backend/.env.supabase.example first."
}

Get-Content -LiteralPath $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') {
        return
    }

    $parts = $_ -split '=', 2
    if ($parts.Length -eq 2) {
        [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
    }
}

if (-not $env:DATABASE_URL) {
    Write-Error "DATABASE_URL is required in backend/.env.supabase."
}

if ($env:DIRECT_URL) {
    [System.Environment]::SetEnvironmentVariable('DATABASE_URL', $env:DIRECT_URL, 'Process')
}

Push-Location $backendDir
try {
    docker compose -f docker-compose.supabase.yml run --rm backend python -m alembic -c alembic.ini upgrade head
}
finally {
    Pop-Location
}
