@echo off
REM Quick script to build a signed release

if "%1"=="" (
    echo Usage: BUILD_SIGNED_RELEASE.bat [version]
    echo Example: BUILD_SIGNED_RELEASE.bat 2.7.0
    pause
    exit /b 1
)

set VERSION=%1
cd "%~dp0student-invoice-tauri"

echo ================================================
echo Building SIGNED version %VERSION%
echo ================================================
echo.

REM Update version in all files
echo Updating version numbers...
powershell -Command "$json = Get-Content 'package.json' | ConvertFrom-Json; $json.version = '%VERSION%'; $json | ConvertTo-Json -Depth 10 | Set-Content 'package.json'"
powershell -Command "$ver = '%VERSION%'; (Get-Content 'src-tauri\Cargo.toml') -replace '^version = .+', ('version = ' + '\"' + $ver + '\"') | Set-Content 'src-tauri\Cargo.toml'"
powershell -Command "$json = Get-Content 'src-tauri\tauri.conf.json' | ConvertFrom-Json; $json.version = '%VERSION%'; $json | ConvertTo-Json -Depth 10 | Set-Content 'src-tauri\tauri.conf.json'"

echo.
echo Reading signing key...
for /f "delims=" %%i in (%~dp0student-invoice-tauri\myapp.key) do set TAURI_SIGNING_PRIVATE_KEY=%%i

echo Building with signing...
pnpm tauri build

if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo ================================================
echo Build complete! Now find the signature...
echo ================================================
echo.

cd src-tauri\target\release\bundle\msi

REM Find the .sig file
for %%f in (*.sig) do (
    echo Signature file: %%f
    echo.
    echo Signature content:
    echo ================================================
    type "%%f"
    echo.
    echo ================================================
    echo.
    echo Copy the signature above and paste it into latest.json
)

echo.
echo Files to upload to GitHub:
dir student-invoice-tauri_%VERSION%_x64_en-US.msi 2>nul
dir student-invoice-tauri_%VERSION%_x64_en-US.msi.sig 2>nul

echo.
pause

