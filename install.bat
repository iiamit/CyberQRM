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

:: ── 5. Ensure data directories exist ────────────────────────
if not exist "%~dp0backend\data" mkdir "%~dp0backend\data"
if not exist "%~dp0backend\data\attack" mkdir "%~dp0backend\data\attack"

:: ── 6. Download MITRE ATT&CK dataset ─────────────────────────
set "ATTACK_FILE=%~dp0backend\data\attack\enterprise-attack-17.1.json"
set "ATTACK_URL=https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack-17.1.json"

if exist "%ATTACK_FILE%" (
    echo   OK  MITRE ATT^&CK dataset already present -- skipping download.
    echo.
) else (
    echo Downloading MITRE ATT^&CK dataset ^(~30 MB^)...
    echo   Source: github.com/mitre-attack/attack-stix-data
    echo.
    powershell -Command "try { Invoke-WebRequest -Uri '%ATTACK_URL%' -OutFile '%ATTACK_FILE%' -UseBasicParsing; Write-Host '  OK  ATT&CK dataset downloaded successfully.' } catch { Write-Host '  WARNING: ATT&CK download failed. ATT&CK features will show data unavailable.'; Write-Host '  You can retry by re-running install.bat, or download manually from:'; Write-Host '  %ATTACK_URL%'; if (Test-Path '%ATTACK_FILE%') { Remove-Item '%ATTACK_FILE%' } }"
    echo.
)

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
