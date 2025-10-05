@echo off
echo ================================================
echo      Student Invoice - Set App Version
echo ================================================
echo.

if "%1"=="" (
    echo Usage: set-version.bat [version]
    echo Example: set-version.bat 1.2.0
    echo.
    echo This will update the version in:
    echo - package.json
    echo - src-tauri/Cargo.toml
    echo - src-tauri/tauri.conf.json
    echo.
    pause
    exit /b 1
)

set VERSION=%1

echo Setting version to %VERSION% in all files...
echo.

pushd "%~dp0student-invoice-tauri"

REM Update package.json
powershell -Command "$json = Get-Content 'package.json' | ConvertFrom-Json; $json.version = '%VERSION%'; $json | ConvertTo-Json -Depth 10 | Set-Content 'package.json'"

REM Update Cargo.toml
powershell -Command "$ver = '%VERSION%'; (Get-Content 'src-tauri\Cargo.toml') -replace '^version = .+', ('version = ' + '\"' + $ver + '\"') | Set-Content 'src-tauri\Cargo.toml'"

REM Update tauri.conf.json
powershell -Command "$json = Get-Content 'src-tauri\tauri.conf.json' | ConvertFrom-Json; $json.version = '%VERSION%'; $json | ConvertTo-Json -Depth 10 | Set-Content 'src-tauri\tauri.conf.json'"

popd

if errorlevel 1 (
    echo Error: Failed to update version files.
    pause
    exit /b 1
)

echo.
echo ================================================
echo Version updated successfully!
echo ================================================
echo.
echo Updated to version %VERSION% in:
echo package.json
echo src-tauri/Cargo.toml
echo src-tauri/tauri.conf.json
echo.
echo You can now run 'build.bat' to build this version.
echo ================================================
pause
