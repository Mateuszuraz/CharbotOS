#!/usr/bin/env bash
set -euo pipefail

# ── Detect SSD root (directory of this script) ───────────────────────────
DRIVE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$DRIVE_ROOT/app"
VAULT_DIR="$DRIVE_ROOT/Vault"
OLLAMA_MODELS_DIR="$DRIVE_ROOT/ollama/models"
OLLAMA_BIN="$DRIVE_ROOT/ollama/ollama"
ENV_FILE="$APP_DIR/.env.local"
PORT=3000

# ── Export env vars ────────────────────────────────────────────────────────
export CHARBOT_VAULT_DIR="$VAULT_DIR"
export CHARBOT_MOBILE_DIR="$VAULT_DIR/MOBILE"
export OLLAMA_MODELS="$OLLAMA_MODELS_DIR"
export NODE_ENV=production
export CHARBOT_OFFLINE=true   # default: offline when run from SSD

# Load .env.local overrides
if [[ -f "$ENV_FILE" ]]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
fi

echo ""
echo " ██████╗██╗  ██╗ █████╗ ██████╗ ██████╗  ██████╗ ████████╗"
echo "██╔════╝██║  ██║██╔══██╗██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝"
echo "██║     ███████║███████║██████╔╝██████╔╝██║   ██║   ██║   "
echo "██║     ██╔══██║██╔══██║██╔══██╗██╔══██╗██║   ██║   ██║   "
echo "╚██████╗██║  ██║██║  ██║██║  ██║██████╔╝╚██████╔╝   ██║   "
echo " ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝    ╚═╝  "
echo ""
echo "  Vault : $VAULT_DIR"
echo "  Ollama: $OLLAMA_MODELS_DIR"
if [[ "${CHARBOT_OFFLINE:-true}" == "true" ]]; then
  echo "  Mode  : [OFFLINE] - Cloud providers disabled"
else
  echo "  Mode  : [ONLINE]  - Cloud providers enabled"
fi
echo ""

# ── Check Node.js ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js not found. Run ./setup.sh first."
  exit 1
fi

# ── Vault dirs ─────────────────────────────────────────────────────────────
mkdir -p "$VAULT_DIR/uploads" "$VAULT_DIR/logs" "$VAULT_DIR/MOBILE"

# ── Start Ollama if not running ────────────────────────────────────────────
if ! curl -s http://localhost:11434/api/version &>/dev/null; then
  echo "[Ollama] Starting..."
  if [[ -x "$OLLAMA_BIN" ]]; then
    OLLAMA_MODELS="$OLLAMA_MODELS_DIR" "$OLLAMA_BIN" serve &
  elif command -v ollama &>/dev/null; then
    OLLAMA_MODELS="$OLLAMA_MODELS_DIR" ollama serve &
  else
    echo "[Ollama] WARNING: not found. Run ./setup.sh to install."
  fi
  sleep 3
  echo "[Ollama] Ready."
else
  echo "[Ollama] Already running."
fi

# ── Open browser after server starts ──────────────────────────────────────
open_browser() {
  sleep 2
  if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT"
  elif command -v open &>/dev/null; then
    open "http://localhost:$PORT"
  fi
}
open_browser &

# ── Start server ───────────────────────────────────────────────────────────
echo "[Charbot] Starting on port $PORT... (Ctrl+C to stop)"
echo ""
exec node "$APP_DIR/dist-server/server.mjs"
