$pythonCandidates = @(
    $env:OWNERMATE_PYTHON,
    "C:\Users\HP\Desktop\Data science\python.exe",
    (Get-Command py -ErrorAction SilentlyContinue | ForEach-Object { "py -3" })
) | Where-Object { $_ }

$pythonCommand = $null

foreach ($candidate in $pythonCandidates) {
    if ($candidate -eq "py -3") {
        try {
            py -3 -m streamlit --version | Out-Null
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
    Write-Error "Could not find a Python executable for the prototype. Set OWNERMATE_PYTHON or update run-prototype.ps1."
    exit 1
}

$command = "$pythonCommand -m streamlit run app.py"
Write-Host "Starting OwnerMate prototype..."
Invoke-Expression $command
