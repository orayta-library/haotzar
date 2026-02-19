@echo off
echo ========================================
echo PDF Indexer - Example Run
echo ========================================
echo.

REM Activate virtual environment
if not exist venv\Scripts\activate.bat (
    echo ERROR: Virtual environment not found!
    echo Please run install.bat first
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo Running indexer with example settings...
echo.

REM Run with 10 files for testing
python build_index.py ^
    --books-dir ..\books ^
    --output-dir .\index ^
    --max-files 10 ^
    --verbose

echo.
echo ========================================
echo Example run completed!
echo ========================================
echo.
echo To run full indexing:
echo   python build_index.py --books-dir ..\books --output-dir .\index --upload-meili
echo.
pause
