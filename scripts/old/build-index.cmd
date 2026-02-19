@echo off
cd /d "%~dp0\.."
echo ========================================
echo Building Search Index
echo ========================================
echo.
echo Current directory: %CD%
echo.
echo This will build the search index for all books.
echo The process saves progress every 5 files.
echo You can press Ctrl+C to pause and resume later.
echo.
pause

node --expose-gc scripts\build-index-optimized.js --meili

echo.
echo ========================================
echo Done!
echo ========================================
pause
