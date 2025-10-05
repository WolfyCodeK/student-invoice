@echo off
echo ================================================
echo      Student Invoice - Rebuild Current Version
echo ================================================
echo.

cd /d "%~dp0"

echo Checking current version...
for /f "tokens=2 delims=:" %%a in ('findstr "version" package.json') do set CURRENT_VERSION=%%a
set CURRENT_VERSION=%CURRENT_VERSION:"=%
set CURRENT_VERSION=%CURRENT_VERSION:,=%
set CURRENT_VERSION=%CURRENT_VERSION: =%

echo Current version: %CURRENT_VERSION%
echo.

if exist node_modules goto :build

echo Installing dependencies first...
pnpm --silent install
echo.

:build
echo Rebuilding application with current version (%CURRENT_VERSION%)...
echo.
echo Setting up signing for update...
for /f "delims=" %%i in (%~dp0myapp.key) do set TAURI_SIGNING_PRIVATE_KEY=%%i
pnpm --silent tauri build

echo.
echo ================================================
echo Rebuild completed successfully!
echo Current version: %CURRENT_VERSION%
echo.
echo Check the 'src-tauri/target/release/bundle' directory for the installer.
echo ================================================
pause