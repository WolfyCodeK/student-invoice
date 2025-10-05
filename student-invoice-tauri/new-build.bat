@echo off
echo ================================================
echo     Student Invoice - Create New Build Version
echo ================================================
echo.

cd /d "%~dp0"

REM Get version from command line argument or prompt for it
if "%1"=="" (
    echo Checking current version...
    for /f "tokens=2 delims=:" %%a in ('findstr "version" package.json') do set CURRENT_VERSION=%%a
    set CURRENT_VERSION=%CURRENT_VERSION:"=%
    set CURRENT_VERSION=%CURRENT_VERSION:,=%
    set CURRENT_VERSION=%CURRENT_VERSION: =%

    echo Current version: %CURRENT_VERSION%
    echo.

    set /p NEW_VERSION="Enter new version (e.g., 1.1.0): "
) else (
    set NEW_VERSION=%1
    echo Using version from command line: %NEW_VERSION%
    echo.
)

if "%NEW_VERSION%"=="" (
    echo Error: Version cannot be empty.
    pause
    exit /b 1
)

echo.
echo Updating version to %NEW_VERSION% in all files...

REM Update package.json
powershell -Command "$json = Get-Content 'package.json' | ConvertFrom-Json; $json.version = '%NEW_VERSION%'; $json | ConvertTo-Json -Depth 10 | Set-Content 'package.json'"

REM Update Cargo.toml
powershell -Command "$ver = '%NEW_VERSION%'; (Get-Content 'src-tauri\Cargo.toml') -replace '^version = .+', ('version = ' + '\"' + $ver + '\"') | Set-Content 'src-tauri\Cargo.toml'"

REM Update tauri.conf.json
powershell -Command "$json = Get-Content 'src-tauri\tauri.conf.json' | ConvertFrom-Json; $json.version = '%NEW_VERSION%'; $json | ConvertTo-Json -Depth 10 | Set-Content 'src-tauri\tauri.conf.json'"

if errorlevel 1 goto :error
echo.

if exist node_modules goto :build

echo Installing dependencies first...
pnpm --silent install
echo.

:build
echo Building new version (%NEW_VERSION%)...
echo.
echo Setting up signing for update...
for /f "delims=" %%i in (%~dp0myapp.key) do set TAURI_SIGNING_PRIVATE_KEY=%%i
pnpm --silent tauri build
if errorlevel 1 goto :error

echo.
echo ================================================
echo Build completed successfully!
echo New version: %NEW_VERSION%
echo.
echo Check the 'src-tauri/target/release/bundle' directory for the installer.
echo ================================================
goto :end

:error
echo Error: Failed to update version files.
pause
exit /b 1

:end
pause
