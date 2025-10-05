@echo off
echo ================================================
echo      Student Invoice - New Release
echo ================================================
echo.

REM Get version from command line argument
if "%1"=="" (
    echo Usage: release.bat [version]
    echo Example: release.bat 2.9.0
    echo.
    pause
    exit /b 1
)

set VERSION=%1

echo Creating new SIGNED release version %VERSION%...
echo Calling PowerShell script for proper signing support...
echo.

REM Call the PowerShell release script
powershell -ExecutionPolicy Bypass -File "%~dp0Release.ps1" -Version %VERSION%

if errorlevel 1 (
    echo Release failed!
    pause
    exit /b 1
)

echo.
pause
