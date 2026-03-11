@echo off
title Charbot OS
setlocal EnableDelayedExpansion

:: ── Detect drive root (folder containing this .bat) ──────────────────────
set "DRIVE_ROOT=%~dp0"
if "%DRIVE_ROOT:~-1%"=="\" set "DRIVE_ROOT=%DRIVE_ROOT:~0,-1%"

:: ── Paths relative to SSD ─────────────────────────────────────────────────
set "APP_DIR=%DRIVE_ROOT%\app"
set "VAULT_DIR=%DRIVE_ROOT%\Vault"
set "OLLAMA_MODELS_DIR=%DRIVE_ROOT%\ollama\models"
set "OLLAMA_BIN=%DRIVE_ROOT%\ollama\ollama.exe"
set "ENV_FILE=%APP_DIR%\.env.local"
set "PORT=3000"

:: ── Env vars passed to server ─────────────────────────────────────────────
set "CHARBOT_VAULT_DIR=%VAULT_DIR%"
set "CHARBOT_MOBILE_DIR=%VAULT_DIR%\MOBILE"
set "OLLAMA_MODELS=%OLLAMA_MODELS_DIR%"
set "NODE_ENV=production"
:: Default: offline mode ON when launched from SSD
set "CHARBOT_OFFLINE=true"

:: Load .env.local overrides if present
if exist "%ENV_FILE%" (
  for /f "usebackq tokens=1,2 delims==" %%a in ("%ENV_FILE%") do (
    if not "%%a"=="" if not "%%b"=="" set "%%a=%%b"
  )
)

echo.
echo  ██████╗██╗  ██╗ █████╗ ██████╗ ██████╗  ██████╗ ████████╗
echo ██╔════╝██║  ██║██╔══██╗██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝
echo ██║     ███████║███████║██████╔╝██████╔╝██║   ██║   ██║
echo ██║     ██╔══██║██╔══██║██╔══██╗██╔══██╗██║   ██║   ██║
echo ╚██████╗██║  ██║██║  ██║██║  ██║██████╔╝╚██████╔╝   ██║
echo  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝    ╚═╝
echo.
echo  Vault : %VAULT_DIR%
echo  Ollama: %OLLAMA_MODELS_DIR%
if "%CHARBOT_OFFLINE%"=="true" (
  echo  Mode  : [OFFLINE] - Cloud providers disabled
) else (
  echo  Mode  : [ONLINE]  - Cloud providers enabled
)
echo.

:: ── Check Node.js ─────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH.
  echo         Run SETUP.bat first to install dependencies.
  pause
  exit /b 1
)

:: ── Ensure Vault dirs exist ───────────────────────────────────────────────
if not exist "%VAULT_DIR%\uploads" mkdir "%VAULT_DIR%\uploads"
if not exist "%VAULT_DIR%\logs"    mkdir "%VAULT_DIR%\logs"
if not exist "%VAULT_DIR%\MOBILE"  mkdir "%VAULT_DIR%\MOBILE"

:: ── Start Ollama if not already running ───────────────────────────────────
curl -s http://localhost:11434/api/version >nul 2>&1
if errorlevel 1 (
  echo [Ollama] Starting Ollama service...
  if exist "%OLLAMA_BIN%" (
    start /b "" "%OLLAMA_BIN%" serve
  ) else (
    where ollama >nul 2>&1
    if not errorlevel 1 (
      start /b "" ollama serve
    ) else (
      echo [Ollama] WARNING: Ollama not found. Run SETUP.bat to install.
    )
  )
  timeout /t 3 /nobreak >nul
  echo [Ollama] Ready.
) else (
  echo [Ollama] Already running.
)

:: ── Start Charbot server ──────────────────────────────────────────────────
echo [Charbot] Starting server on port %PORT%...
echo [Charbot] Press Ctrl+C to stop.
echo.

:: Open browser after short delay
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%"

:: Run server (blocking)
node "%APP_DIR%\dist-server\server.mjs"

echo.
echo [Charbot] Server stopped.
pause
