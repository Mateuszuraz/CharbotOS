@echo off
title Charbot OS — First Time Setup
setlocal EnableDelayedExpansion

set "DRIVE_ROOT=%~dp0"
if "%DRIVE_ROOT:~-1%"=="\" set "DRIVE_ROOT=%DRIVE_ROOT:~0,-1%"

set "APP_DIR=%DRIVE_ROOT%\app"
set "OLLAMA_DIR=%DRIVE_ROOT%\ollama"
set "OLLAMA_MODELS_DIR=%OLLAMA_DIR%\models"
set "OLLAMA_BIN=%OLLAMA_DIR%\ollama.exe"

:: Default models to pull (edit this list to change what ships on the SSD)
:: Format: space-separated model names
set "MODELS_TO_PULL=llama3.2 nomic-embed-text"

echo.
echo  CHARBOT OS — SETUP
echo  ==================
echo  Drive: %DRIVE_ROOT%
echo.

:: ── Node.js check ─────────────────────────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
  echo [1/4] Node.js not found.
  echo       Please download and install Node.js from https://nodejs.org
  echo       then re-run this setup.
  pause
  exit /b 1
) else (
  for /f "tokens=*" %%v in ('node --version') do echo [1/4] Node.js %%v found. OK
)

:: ── Ollama install ────────────────────────────────────────────────────────
where ollama >nul 2>&1
if errorlevel 1 (
  if exist "%OLLAMA_BIN%" (
    echo [2/4] Using bundled Ollama at %OLLAMA_BIN%
    set "PATH=%OLLAMA_DIR%;%PATH%"
  ) else (
    echo [2/4] Ollama not found. Downloading installer...
    mkdir "%OLLAMA_DIR%" 2>nul
    curl -L -o "%OLLAMA_DIR%\OllamaSetup.exe" "https://ollama.com/download/OllamaSetup.exe"
    echo       Running Ollama installer...
    "%OLLAMA_DIR%\OllamaSetup.exe" /silent
    timeout /t 5 /nobreak >nul
    echo [2/4] Ollama installed.
  )
) else (
  for /f "tokens=*" %%v in ('ollama --version') do echo [2/4] Ollama %%v found. OK
)

:: ── Create Vault structure ────────────────────────────────────────────────
echo [3/4] Creating Vault structure...
mkdir "%DRIVE_ROOT%\Vault\uploads" 2>nul
mkdir "%DRIVE_ROOT%\Vault\logs"    2>nul
mkdir "%DRIVE_ROOT%\Vault\MOBILE"  2>nul
mkdir "%OLLAMA_MODELS_DIR%"        2>nul

:: ── Pull Ollama models to SSD ─────────────────────────────────────────────
echo [4/4] Pulling AI models to SSD...
echo       (This may take a while depending on your internet connection)
echo       Models: %MODELS_TO_PULL%
echo.

set "OLLAMA_MODELS=%OLLAMA_MODELS_DIR%"

:: Start Ollama service temporarily for pull
start /b "" ollama serve 2>nul
timeout /t 3 /nobreak >nul

for %%m in (%MODELS_TO_PULL%) do (
  echo       Pulling %%m...
  ollama pull %%m
  if errorlevel 1 (
    echo       [WARNING] Could not pull %%m - skipping.
  ) else (
    echo       %%m downloaded.
  )
)

echo.
echo  ══════════════════════════════════════
echo  Setup complete!
echo.
echo  To configure API keys (optional):
echo    Edit %APP_DIR%\.env.local
echo.
echo  Run START.bat to launch Charbot OS.
echo  ══════════════════════════════════════
echo.
pause
