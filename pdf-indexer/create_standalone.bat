@echo off
setlocal enabledelayedexpansion

echo ========================================
echo PDF Indexer - Create Standalone Package
echo ========================================
echo.
echo This will create a fully portable package
echo that works WITHOUT internet connection!
echo.

set OUTPUT_DIR=pdf-indexer-standalone
set WHEELS_DIR=%OUTPUT_DIR%\wheels

REM Clean old package
if exist %OUTPUT_DIR% (
    echo Cleaning old package...
    rmdir /s /q %OUTPUT_DIR%
)

echo.
echo Step 1: Creating directory structure...
mkdir %OUTPUT_DIR%
mkdir %WHEELS_DIR%

REM Copy source files
echo Step 2: Copying source files...
xcopy /Y *.py %OUTPUT_DIR%\
xcopy /E /I /Y templates %OUTPUT_DIR%\templates
copy /Y requirements.txt %OUTPUT_DIR%\
copy /Y config.py %OUTPUT_DIR%\
copy /Y *.md %OUTPUT_DIR%\

REM Download all dependencies as wheels
echo.
echo Step 3: Downloading all dependencies (this may take a few minutes)...
echo This includes Python packages that will work offline.
echo.

pip download -r requirements.txt -d %WHEELS_DIR%

if errorlevel 1 (
    echo ERROR: Failed to download dependencies
    pause
    exit /b 1
)

REM Create install script for offline installation
echo.
echo Step 4: Creating offline install script...

(
echo @echo off
echo echo ========================================
echo echo PDF Indexer - Offline Installation
echo echo ========================================
echo echo.
echo.
echo REM Check Python
echo python --version ^>nul 2^>^&1
echo if errorlevel 1 ^(
echo     echo ERROR: Python not found!
echo     echo Please install Python 3.8+ from https://www.python.org/
echo     echo.
echo     echo Or use the portable Python version if provided.
echo     pause
echo     exit /b 1
echo ^)
echo.
echo echo Python found!
echo python --version
echo echo.
echo.
echo echo Creating virtual environment...
echo python -m venv venv
echo if errorlevel 1 ^(
echo     echo ERROR: Failed to create virtual environment
echo     pause
echo     exit /b 1
echo ^)
echo.
echo echo Activating virtual environment...
echo call venv\Scripts\activate.bat
echo.
echo echo Installing dependencies from local wheels...
echo pip install --no-index --find-links=wheels -r requirements.txt
echo.
echo if errorlevel 1 ^(
echo     echo ERROR: Failed to install dependencies
echo     pause
echo     exit /b 1
echo ^)
echo.
echo echo.
echo echo ========================================
echo echo Installation completed successfully!
echo echo ========================================
echo echo.
echo echo To run the indexer:
echo echo   1. Run: run_ui.bat
echo echo   2. Open browser: http://localhost:5000
echo echo.
echo pause
) > %OUTPUT_DIR%\install_offline.bat

REM Create run script
(
echo @echo off
echo echo ========================================
echo echo PDF Indexer - Web UI
echo echo ========================================
echo echo.
echo.
echo if not exist venv\Scripts\activate.bat ^(
echo     echo ERROR: Virtual environment not found!
echo     echo Please run install_offline.bat first
echo     pause
echo     exit /b 1
echo ^)
echo.
echo call venv\Scripts\activate.bat
echo.
echo echo Starting web server...
echo echo.
echo echo Open in browser: http://localhost:5000
echo echo Press Ctrl+C to stop
echo echo.
echo.
echo python web_ui.py
echo.
echo pause
) > %OUTPUT_DIR%\run_ui.bat

REM Create README
(
echo # PDF Indexer - Standalone Package
echo.
echo ## What's included?
echo.
echo This package includes:
echo - All Python source code
echo - All required libraries ^(wheels^)
echo - Installation scripts
echo - Documentation
echo.
echo ## Installation ^(Offline^)
echo.
echo 1. Make sure Python 3.8+ is installed on the target computer
echo 2. Run: `install_offline.bat`
echo 3. Wait for installation to complete
echo.
echo ## Usage
echo.
echo 1. Run: `run_ui.bat`
echo 2. Open browser: http://localhost:5000
echo.
echo ## Requirements
echo.
echo - Python 3.8 or higher
echo - Windows OS
echo - No internet connection needed!
echo.
echo ## File Structure
echo.
echo ```
echo pdf-indexer-standalone/
echo ├── wheels/              ^(All Python packages^)
echo ├── templates/           ^(HTML files^)
echo ├── *.py                ^(Source code^)
echo ├── install_offline.bat ^(Offline installer^)
echo ├── run_ui.bat          ^(Run script^)
echo └── README.md           ^(This file^)
echo ```
echo.
echo ## Troubleshooting
echo.
echo ### Python not found
echo Install Python from: https://www.python.org/downloads/
echo Make sure to check "Add Python to PATH" during installation.
echo.
echo ### Installation fails
echo Make sure you have write permissions in the directory.
echo Try running as Administrator.
echo.
echo ## Support
echo.
echo See the included documentation files ^(*.md^) for detailed guides.
) > %OUTPUT_DIR%\README.md

REM Count wheels
set /a wheel_count=0
for %%f in (%WHEELS_DIR%\*.whl) do set /a wheel_count+=1

REM Calculate size
set /a total_size=0
for /r %OUTPUT_DIR% %%f in (*) do set /a total_size+=%%~zf
set /a size_mb=total_size / 1048576

echo.
echo ========================================
echo Standalone package created successfully!
echo ========================================
echo.
echo Location: %OUTPUT_DIR%\
echo Packages: %wheel_count% wheels
echo Size: ~%size_mb% MB
echo.
echo This package includes:
echo   - All source code
echo   - All Python dependencies ^(%wheel_count% packages^)
echo   - Offline installation script
echo   - Full documentation
echo.
echo To use on another computer:
echo   1. Copy the entire '%OUTPUT_DIR%' folder
echo   2. On target computer, run: install_offline.bat
echo   3. Then run: run_ui.bat
echo.
echo No internet connection needed on target computer!
echo ^(Python 3.8+ must be installed^)
echo.
pause
