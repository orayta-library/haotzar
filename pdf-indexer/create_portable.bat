@echo off
echo ========================================
echo PDF Indexer - Create Portable Package
echo ========================================
echo.

set OUTPUT=pdf-indexer-portable.zip

echo Creating portable package...
echo.

REM Delete old package if exists
if exist %OUTPUT% (
    echo Deleting old package...
    del %OUTPUT%
)

REM Create zip (requires PowerShell)
echo Compressing files...
powershell -Command "Compress-Archive -Path @('*.py', 'templates', 'requirements.txt', 'config.py', 'install.bat', 'run_ui.bat', 'run_example.bat', '*.md') -DestinationPath '%OUTPUT%' -Force"

if errorlevel 1 (
    echo ERROR: Failed to create package
    pause
    exit /b 1
)

echo.
echo ========================================
echo Package created successfully!
echo ========================================
echo.
echo File: %OUTPUT%
echo.

REM Show file size
for %%A in (%OUTPUT%) do (
    set size=%%~zA
    set /a sizeMB=!size! / 1048576
    echo Size: !sizeMB! MB
)

echo.
echo To use on another computer:
echo   1. Extract the zip file
echo   2. Run install.bat
echo   3. Run run_ui.bat
echo.
pause
