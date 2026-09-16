# ListMaster - Tauri Dev (Windows)
# Startet tauri dev und schreibt Output in tauri-dev.log (lesbar aus WSL)

$logDir = $PSScriptRoot
$logFile = Join-Path $logDir "tauri-dev.log"
$ErrorActionPreference = "Continue"

# Fallback auf timestamped Log falls Datei von WSL gesperrt ist
$fs = $null
try {
    $fs = [System.IO.FileStream]::new(
        $logFile,
        [System.IO.FileMode]::Create,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::ReadWrite
    )
} catch {
    $logFile = Join-Path $logDir "tauri-dev-$(Get-Date -Format 'HHmmss').log"
    Write-Host "tauri-dev.log gesperrt - schreibe nach: $logFile" -ForegroundColor Yellow
    $fs = [System.IO.FileStream]::new(
        $logFile,
        [System.IO.FileMode]::Create,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::ReadWrite
    )
}

$writer = [System.IO.StreamWriter]::new($fs, [System.Text.Encoding]::UTF8)
$writer.AutoFlush = $true

Write-Host "Starte Tauri dev... (Log: $logFile)" -ForegroundColor Cyan

npm run tauri dev 2>&1 | ForEach-Object {
    $line = "$_"
    Write-Host $line
    $writer.WriteLine($line)
}

$writer.Close()
$fs.Close()
