param(
    [switch]$SkipInstall
)

Write-Host "Starting Student Invoice Tauri App in Development Mode..." -ForegroundColor Green
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Ensure Cargo is in PATH
if (-not $env:PATH.Contains("$env:USERPROFILE\.cargo\bin")) {
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
}

if ((Test-Path "node_modules") -and -not $SkipInstall) {
    Write-Host "Node modules found. Starting development server..." -ForegroundColor Yellow
    & pnpm --silent tauri dev
} else {
    if (-not $SkipInstall) {
        Write-Host "Installing dependencies first..." -ForegroundColor Yellow
        & pnpm --silent install
    }
    Write-Host "Starting development server..." -ForegroundColor Yellow
    & pnpm --silent tauri dev
}
