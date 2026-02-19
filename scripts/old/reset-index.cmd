@echo off
cd /d "%~dp0\.."
echo ========================================
echo Reset Index Build
echo ========================================
echo.
echo Current directory: %CD%
echo.
echo This will delete all checkpoint files and start fresh.
echo.
echo WARNING: This will delete:
echo   - index\checkpoint.json
echo   - index\meili-docs.temp.json
echo   - index\meili-docs.json
echo   - index\posmap.sqlite
echo   - index\posmap.sqlite-journal
echo.
set /p confirm="Are you sure? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo Cancelled.
    pause
    exit /b
)

echo.
echo Deleting checkpoint files...

if exist index\checkpoint.json del /q index\checkpoint.json
if exist index\meili-docs.temp.json del /q index\meili-docs.temp.json
if exist index\meili-docs.json del /q index\meili-docs.json
if exist index\posmap.sqlite del /q index\posmap.sqlite
if exist index\posmap.sqlite-journal del /q index\posmap.sqlite-journal

echo.
echo ========================================
echo Checkpoint files deleted!
echo You can now run build-index.cmd to start fresh.
echo ========================================
pause
