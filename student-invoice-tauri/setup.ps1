Write-Host "Setting up Student Invoice Tauri Development Environment..." -ForegroundColor Green
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
& pnpm install

Write-Host ""
Write-Host "Installing Rust dependencies (this may take a while)..." -ForegroundColor Yellow
& cargo build --release

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start development:" -ForegroundColor Cyan
Write-Host "  Run: .\dev.ps1 (or .\dev.bat)" -ForegroundColor White
Write-Host ""
Write-Host "To build for production:" -ForegroundColor Cyan
Write-Host "  Run: .\build.ps1 (or .\build.bat)" -ForegroundColor White
Write-Host ""
Write-Host "Make sure you have set up your Google API credentials in the settings or environment variables." -ForegroundColor Yellow
Write-Host "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET" -ForegroundColor White
