@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20.19+ or 22.12+ and try again.
  pause
  exit /b 1
)

where corepack >nul 2>nul
if errorlevel 1 (
  echo Corepack was not found. Reinstall Node.js with Corepack enabled.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Installing project dependencies. This needs an internet connection on first run.
  call corepack yarn@1.22.22 install --frozen-lockfile
  if errorlevel 1 goto install_failed
)

echo.
echo Starting YOLO Vision. Keep this window open while using the app.
echo Open the Local URL printed below in your browser.
echo.
call corepack yarn@1.22.22 dev
echo.
echo The development server has stopped.
pause
exit /b 0

:install_failed
echo Dependency installation failed. Check your internet connection and try again.
pause
exit /b 1
