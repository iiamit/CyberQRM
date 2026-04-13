@echo off
setlocal EnableDelayedExpansion
:: ============================================================
::  CyberQRM - Start Script (Windows)
:: ============================================================

echo.
echo ============================================
echo   CyberQRM - FAIR Risk Management Platform
echo ============================================
echo.

:: ── Check Node.js ────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js is not installed.
    echo.
    echo  Run install.bat first, or download Node.js from:
    echo  https://nodejs.org/en/download
    echo.
    pause
    exit /b 1
)

for /f "tokens=1,2,3 delims=." %%a in ('node -v') do (
    set "ver_major=%%a"
    set "ver_minor=%%b"
)
set "ver_major=%ver_major:~1%"

if %ver_major% LSS 22 (
    echo  ERROR: Node.js 22.5+ is required. Run install.bat for guidance.
    echo.
    pause
    exit /b 1
)

:: ── Check dependencies ────────────────────────────────────────
if not exist "%~dp0backend\node_modules" (
    echo  Dependencies not found. Running installer...
    echo.
    call "%~dp0install.bat"
)

:: ── Start backend ─────────────────────────────────────────────
echo  Starting backend ^(port 3001^)...
start "CyberQRM Backend (port 3001)" cmd /k "cd /d %~dp0backend && npm run dev"

:: Wait for backend to initialise
timeout /t 4 /nobreak > nul

:: ── Start frontend ────────────────────────────────────────────
echo  Starting frontend ^(port 5173^)...
start "CyberQRM Frontend (port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  Backend API : http://localhost:3001
echo  Frontend App: http://localhost:5173
echo.
echo  ^(If port 5173 is busy, Vite will automatically use 5174^)
echo.
echo  Opening browser in 5 seconds...
timeout /t 5 /nobreak > nul
start "" http://localhost:5173
