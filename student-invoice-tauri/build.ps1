param(
    [switch]$SkipInstall
)

Write-Host "Building Student Invoice Tauri App for Production..." -ForegroundColor Green
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if ((Test-Path "node_modules") -and -not $SkipInstall) {
    Write-Host "Building application..." -ForegroundColor Yellow
    & pnpm tauri build
} else {
    if (-not $SkipInstall) {
        Write-Host "Installing dependencies first..." -ForegroundColor Yellow
        & pnpm install
    }
    Write-Host "Building application..." -ForegroundColor Yellow
    & pnpm tauri build
}

Write-Host ""
Write-Host "Build completed! Check the 'src-tauri/target/release/bundle' directory for the installer." -ForegroundColor Green
