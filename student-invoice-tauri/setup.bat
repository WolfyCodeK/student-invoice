@echo off
echo Setting up Student Invoice Tauri Development Environment...
echo.

cd /d "%~dp0"

echo Installing Node.js dependencies...
pnpm install

echo.
echo Installing Rust dependencies (this may take a while)...
cargo build --release

echo.
echo Setup complete!
echo.
echo To start development:
echo   Run: dev.bat (or dev.ps1)
echo.
echo To build for production:
echo   Run: build.bat (or build.ps1)
echo.
echo Make sure you have set up your Google API credentials in the settings or environment variables.
echo GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
echo.
pause
