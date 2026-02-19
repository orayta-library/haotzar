@echo off
echo ========================================
echo PDF Indexer - Web UI
echo ========================================
echo.

if not exist venv\Scripts\activate.bat (
    echo ERROR: Virtual environment not found
    echo Please run install_offline.bat first
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo Starting web server...
echo.
echo Open in browser: http://localhost:5000
echo Press Ctrl+C to stop
echo.

python web_ui.py

pause
