@echo off
setlocal EnableDelayedExpansion
:: ============================================================
::  CyberQRM - Install Script (Windows)
:: ============================================================

echo.
echo ============================================
echo   CyberQRM - FAIR Risk Management Platform
echo   Installation Script
echo ============================================
echo.

:: ── 1. Check Node.js ────────────────────────────────────────
echo Checking prerequisites...

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Node.js is not installed.
    echo.
    echo  CyberQRM requires Node.js 22.5 or later.
    echo.
    echo  Install from: https://nodejs.org/en/download
    echo  Choose the "LTS" or "Current" installer for Windows.
    echo.
    pause
    exit /b 1
)

:: Extract major and minor version numbers
for /f "tokens=1,2,3 delims=." %%a in ('node -v') do (
    set "ver_full=%%a.%%b.%%c"
    set "ver_major=%%a"
    set "ver_minor=%%b"
)
:: Remove the leading 'v' from major version
set "ver_major=%ver_major:~1%"

if %ver_major% LSS 22 (
    echo.
    echo  ERROR: Node.js 22.5+ is required ^(found v%ver_full%^).
    echo.
    echo  Please upgrade: https://nodejs.org/en/download
    echo.
    pause
    exit /b 1
)
if %ver_major% EQU 22 if %ver_minor% LSS 5 (
    echo.
    echo  ERROR: Node.js 22.5+ is required ^(found v%ver_full%^).
    echo.
    echo  Please upgrade: https://nodejs.org/en/download
    echo.
    pause
    exit /b 1
)

echo   OK  Node.js v%ver_full%

where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: npm is not installed ^(it usually ships with Node.js^).
    echo.
    pause
    exit /b 1
)
for /f %%v in ('npm -v') do set "npm_ver=%%v"
echo   OK  npm v%npm_ver%
echo.

:: ── 2. Install root dependencies ────────────────────────────
echo Installing root dependencies...
cd /d "%~dp0"
call npm install
if errorlevel 1 ( echo. & echo  ERROR: Root npm install failed. & pause & exit /b 1 )
echo.

:: ── 3. Install backend dependencies ─────────────────────────
echo Installing backend dependencies...
cd /d "%~dp0backend"
call npm install
if errorlevel 1 ( echo. & echo  ERROR: Backend npm install failed. & pause & exit /b 1 )
echo.

:: ── 4. Install frontend dependencies ────────────────────────
echo Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 ( echo. & echo  ERROR: Frontend npm install failed. & pause & exit /b 1 )
echo.

:: ── 5. Ensure data directory exists ─────────────────────────
if not exist "%~dp0backend\data" mkdir "%~dp0backend\data"

:: ── Done ─────────────────────────────────────────────────────
echo ============================================
echo   Installation complete!
echo ============================================
echo.
echo  To start CyberQRM, run:
echo.
echo    start.bat
echo.
pause
