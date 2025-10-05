@echo off
echo Starting Student Invoice Tauri App in Development Mode...
echo.

cd /d "%~dp0"

REM Add Rust/Cargo to PATH if not already there
if not defined CARGO_HOME (
    set "CARGO_HOME=%USERPROFILE%\.cargo"
)
set "PATH=%CARGO_HOME%\bin;%PATH%"

if exist node_modules (
    echo Node modules found. Starting development server...
    pnpm --silent tauri dev
) else (
    echo Installing dependencies first...
    pnpm --silent install
    echo Starting development server...
    pnpm --silent tauri dev
)
