@echo off
setlocal enabledelayedexpansion

echo ========================================
echo PDF Indexer - Fully Portable Package
echo ========================================
echo.
echo This creates a COMPLETE portable package including:
echo   - Python interpreter
echo   - All dependencies
echo   - Source code
echo.
echo NO installation needed on target computer!
echo.
pause

set OUTPUT_DIR=pdf-indexer-fully-portable
set PYTHON_DIR=%OUTPUT_DIR%\python
set WHEELS_DIR=%OUTPUT_DIR%\wheels

REM Clean old package
if exist %OUTPUT_DIR% (
    echo Cleaning old package...
    rmdir /s /q %OUTPUT_DIR%
)

echo.
echo Step 1: Creating directory structure...
mkdir %OUTPUT_DIR%
mkdir %PYTHON_DIR%
mkdir %WHEELS_DIR%

REM Copy source files
echo Step 2: Copying source files...
xcopy /Y *.py %OUTPUT_DIR%\
xcopy /E /I /Y templates %OUTPUT_DIR%\templates
copy /Y requirements.txt %OUTPUT_DIR%\
copy /Y config.py %OUTPUT_DIR%\
copy /Y *.md %OUTPUT_DIR%\

REM Download Python embeddable
echo.
echo Step 3: Downloading Python embeddable...
echo This is a portable Python that doesn't need installation.
echo.

set PYTHON_VERSION=3.11.9
set PYTHON_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-embed-amd64.zip
set PYTHON_ZIP=%TEMP%\python-embed.zip

echo Downloading Python %PYTHON_VERSION% embeddable...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile '%PYTHON_ZIP%'}"

if errorlevel 1 (
    echo.
    echo WARNING: Could not download Python automatically.
    echo.
    echo Please download manually:
    echo 1. Go to: https://www.python.org/downloads/
    echo 2. Download: Python %PYTHON_VERSION% embeddable package ^(Windows x86-64^)
    echo 3. Extract to: %PYTHON_DIR%\
    echo 4. Run this script again
    echo.
    pause
    exit /b 1
)

echo Extracting Python...
powershell -Command "Expand-Archive -Path '%PYTHON_ZIP%' -DestinationPath '%PYTHON_DIR%' -Force"

REM Configure Python to use pip
echo.
echo Step 4: Configuring Python...

REM Uncomment import site in python311._pth
for %%f in (%PYTHON_DIR%\python*._pth) do (
    powershell -Command "(Get-Content '%%f') -replace '#import site', 'import site' | Set-Content '%%f'"
)

REM Download get-pip.py
echo Downloading pip installer...
powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '%PYTHON_DIR%\get-pip.py'"

REM Install pip
echo Installing pip...
%PYTHON_DIR%\python.exe %PYTHON_DIR%\get-pip.py --no-warn-script-location

REM Download all dependencies
echo.
echo Step 5: Downloading all dependencies...
%PYTHON_DIR%\python.exe -m pip download -r requirements.txt -d %WHEELS_DIR%

if errorlevel 1 (
    echo ERROR: Failed to download dependencies
    pause
    exit /b 1
)

REM Create startup script
echo.
echo Step 6: Creating startup scripts...

(
echo @echo off
echo setlocal
echo.
echo set SCRIPT_DIR=%%~dp0
echo set PYTHON_DIR=%%SCRIPT_DIR%%python
echo set VENV_DIR=%%SCRIPT_DIR%%venv
echo.
echo echo ========================================
echo echo PDF Indexer - First Time Setup
echo echo ========================================
echo echo.
echo.
echo if exist "%%VENV_DIR%%\Scripts\python.exe" ^(
echo     echo Virtual environment already exists.
echo     goto :run
echo ^)
echo.
echo echo Creating virtual environment...
echo "%%PYTHON_DIR%%\python.exe" -m venv "%%VENV_DIR%%"
echo.
echo echo Installing dependencies from local wheels...
echo "%%VENV_DIR%%\Scripts\python.exe" -m pip install --no-index --find-links=wheels -r requirements.txt
echo.
echo if errorlevel 1 ^(
echo     echo ERROR: Failed to install dependencies
echo     pause
echo     exit /b 1
echo ^)
echo.
echo echo Setup complete!
echo echo.
echo.
echo :run
echo echo ========================================
echo echo PDF Indexer - Web UI
echo echo ========================================
echo echo.
echo echo Starting web server...
echo echo.
echo echo Open in browser: http://localhost:5000
echo echo Press Ctrl+C to stop
echo echo.
echo.
echo "%%VENV_DIR%%\Scripts\python.exe" web_ui.py
echo.
echo pause
) > %OUTPUT_DIR%\START.bat

REM Create README
(
echo # PDF Indexer - Fully Portable Package
echo.
echo ## What's This?
echo.
echo This is a COMPLETE portable package that includes:
echo - ✅ Python interpreter ^(no installation needed^)
echo - ✅ All required libraries
echo - ✅ All source code
echo - ✅ Everything needed to run offline
echo.
echo ## How to Use
echo.
echo ### On ANY Windows computer:
echo.
echo 1. Copy this entire folder to the target computer
echo 2. Double-click: `START.bat`
echo 3. Wait for first-time setup ^(~1 minute^)
echo 4. Browser will open automatically
echo.
echo That's it! No installation, no internet needed!
echo.
echo ## First Run
echo.
echo The first time you run START.bat:
echo - It creates a virtual environment
echo - Installs all packages from local wheels
echo - Takes about 1-2 minutes
echo.
echo After that, it starts instantly!
echo.
echo ## System Requirements
echo.
echo - Windows 7 or later
echo - 64-bit system
echo - ~500 MB free space
echo - No admin rights needed
echo - No internet needed
echo.
echo ## What's Included?
echo.
echo ```
echo pdf-indexer-fully-portable/
echo ├── python/              ^(Portable Python 3.11^)
echo ├── wheels/              ^(All packages - offline^)
echo ├── templates/           ^(Web UI^)
echo ├── *.py                ^(Source code^)
echo ├── START.bat           ^(Run this!^)
echo └── README.md           ^(This file^)
echo ```
echo.
echo ## Troubleshooting
echo.
echo ### "Python was not found"
echo This shouldn't happen! The package includes Python.
echo Make sure you copied the entire folder.
echo.
echo ### "Access denied"
echo Try running from a location where you have write permissions.
echo Desktop or Documents folder usually works.
echo.
echo ### Antivirus blocking
echo Some antivirus software may block Python.
echo Add the folder to your antivirus exceptions.
echo.
echo ## File Size
echo.
echo - Python: ~30 MB
echo - Packages: ~100 MB
echo - Total: ~150 MB
echo.
echo Worth it for complete portability!
echo.
echo ## Support
echo.
echo See the included *.md files for detailed documentation.
) > %OUTPUT_DIR%\README.md

REM Calculate final size
set /a total_size=0
for /r %OUTPUT_DIR% %%f in (*) do set /a total_size+=%%~zf
set /a size_mb=total_size / 1048576

echo.
echo ========================================
echo Fully Portable Package Created!
echo ========================================
echo.
echo Location: %OUTPUT_DIR%\
echo Size: ~%size_mb% MB
echo.
echo This package includes EVERYTHING:
echo   ✅ Python interpreter
echo   ✅ All dependencies
echo   ✅ Source code
echo   ✅ Documentation
echo.
echo To use on ANY Windows computer:
echo   1. Copy the '%OUTPUT_DIR%' folder
echo   2. Run: START.bat
echo   3. That's it!
echo.
echo No installation needed!
echo No internet needed!
echo No admin rights needed!
echo.
echo Perfect for:
echo   - Computers without internet
echo   - Restricted environments
echo   - Quick deployment
echo   - Backup/archive
echo.
pause
