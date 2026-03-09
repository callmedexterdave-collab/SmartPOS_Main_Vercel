@echo off
echo ===================================================
echo Starting SmartPOS Application
echo ===================================================
echo.
echo Step 1: Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error installing dependencies. Please check your internet connection.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Step 2: Starting Development Server...
echo Please wait for "serving on port 5000" to appear.
echo Then verify the preview in your IDE or browser.
echo.
call npm run dev

pause
