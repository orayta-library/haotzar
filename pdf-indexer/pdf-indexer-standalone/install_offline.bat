@echo off
echo ========================================
echo PDF Indexer - Offline Installation
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found
    echo Please install Python 3.8+ from https://www.python.org/
    echo.
    echo Or use the portable Python version if provided.
    pause
    exit /b 1
)

echo Python found
python --version
echo.

echo Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies from local wheels...
pip install --no-index --find-links=wheels -r requirements.txt

if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation completed successfully
echo ========================================
echo.
echo To run the indexer:
echo   1. Run: run_ui.bat
echo   2. Open browser: http://localhost:5000
echo.
pause
