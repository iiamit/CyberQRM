@echo off
echo ============================================
echo  CyberQRM - FAIR Risk Management Platform
echo ============================================
echo.

set "PATH=%PATH%;C:\Program Files\nodejs"

:: Start backend
start "CyberQRM Backend (port 3001)" cmd /k "cd /d %~dp0backend && npm run dev"

:: Wait briefly for backend
timeout /t 4 /nobreak > nul

:: Start frontend
start "CyberQRM Frontend (port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  Backend API : http://localhost:3001
echo  Frontend App: http://localhost:5173
echo.
echo  (If port 5173 is busy, Vite will use 5174)
echo.
echo  Opening browser in 5 seconds...
timeout /t 5 /nobreak > nul
start "" http://localhost:5173
