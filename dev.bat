@echo off
echo ================================================
echo      Student Invoice - Development Server
echo ================================================
echo.

cd /d "%~dp0student-invoice-tauri"

echo Starting development server...
echo.

call dev.bat

echo.
echo ================================================
echo Development server stopped.
echo ================================================
pause
