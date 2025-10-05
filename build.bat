@echo off
echo ================================================
echo      Student Invoice - Local Build
echo ================================================
echo.

pushd "%~dp0student-invoice-tauri"

echo Rebuilding current version for local testing...
echo.

call build.bat

popd

echo.
echo ================================================
echo Local build completed successfully!
echo ================================================
echo.
echo The application has been rebuilt with the current version.
echo You can find the executable in the student-invoice-tauri directory.
echo ================================================
pause
