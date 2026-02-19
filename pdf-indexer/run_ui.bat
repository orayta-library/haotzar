@echo off
echo ========================================
echo PDF Indexer - Web UI
echo ========================================
echo.

REM Activate virtual environment if exists
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

echo Starting web server...
echo.
echo Open in browser: http://localhost:5000
echo Press Ctrl+C to stop
echo.

python web_ui.py

pause
