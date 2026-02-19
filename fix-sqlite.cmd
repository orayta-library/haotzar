@echo off
echo ========================================
echo   תיקון better-sqlite3
echo ========================================
echo.

echo מבצע rebuild של better-sqlite3...
call npm rebuild better-sqlite3

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   ✅ התיקון הושלם בהצלחה!
    echo ========================================
    echo.
    echo עכשיו תוכל להריץ:
    echo   npm run electron:dev
    echo.
) else (
    echo.
    echo ========================================
    echo   ❌ התיקון נכשל
    echo ========================================
    echo.
    echo נסה להריץ ידנית:
    echo   npm install --force better-sqlite3
    echo.
)

pause
