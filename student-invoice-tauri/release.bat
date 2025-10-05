@echo off
echo ================================================
echo      Student Invoice - Automated Release
echo ================================================
echo.

cd /d "%~dp0"

if "%1"=="" (
    echo Usage: release.bat [version]
    echo Example: release.bat 1.1.0
    echo.
    echo This will:
    echo 1. Update version numbers
    echo 2. Build the application
    echo 3. Commit changes
    echo 4. Create git tag
    echo 5. Push to trigger GitHub Actions release
    echo.
    pause
    exit /b 1
)

set VERSION=%1

echo Building new version %VERSION%...
call new-build.bat %VERSION%
if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo ================================================
echo Release Preparation Complete!
echo ================================================
echo.
echo Version %VERSION% built successfully!
echo.
echo Next steps:
echo 1. Test the built application
echo 2. If everything works, run these commands:
echo.
echo git add .
echo git commit -m "Bump version to %VERSION%"
echo git tag v%VERSION%
echo git push origin main
echo git push origin v%VERSION%
echo.
echo ================================================
pause
