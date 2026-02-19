@echo off
cd /d "%~dp0"
cd ..
echo ========================================
echo Building Partial Search Index
echo ========================================
echo.
echo This will index the FIRST 50 PDF files for testing
echo Estimated time: 5-10 minutes
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo Starting index build...
echo.

node scripts/build-index-optimized.js --meili --outDir index --maxFiles 50 --flushEvery 10

echo.
echo ========================================
echo Partial index build complete!
echo Now run: node scripts/upload-to-meili.js
echo ========================================
pause
