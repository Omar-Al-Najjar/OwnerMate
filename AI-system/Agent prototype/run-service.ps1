$pythonCandidates = @(
    $env:OWNERMATE_PYTHON,
    "C:\Users\HP\Desktop\Data science\python.exe",
    (Get-Command py -ErrorAction SilentlyContinue | ForEach-Object { "py -3" })
) | Where-Object { $_ }

$pythonCommand = $null

foreach ($candidate in $pythonCandidates) {
    if ($candidate -eq "py -3") {
        try {
            py -3 -m uvicorn --version | Out-Null
            $pythonCommand = $candidate
            break
        } catch {
        }
    } elseif (Test-Path $candidate) {
        $pythonCommand = "& `"$candidate`""
        break
    }
}

if (-not $pythonCommand) {
    Write-Error "Could not find a Python executable for the analysis service. Set OWNERMATE_PYTHON or update run-service.ps1."
    exit 1
}

$command = "$pythonCommand -m uvicorn api_service:app --host 127.0.0.1 --port 8020"
Write-Host "Starting OwnerMate dataset analysis service..."
Invoke-Expression $command
