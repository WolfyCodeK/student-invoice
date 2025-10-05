@echo off
echo Building Student Invoice Tauri App for Production...
echo.

cd /d "%~dp0"
if exist node_modules (
    echo Building application...
    pnpm --silent tauri build
) else (
    echo Installing dependencies first...
    pnpm --silent install
    echo Building application...
    pnpm --silent tauri build
)

echo.
echo Build completed! Check the 'src-tauri/target/release/bundle' directory for the installer.
pause