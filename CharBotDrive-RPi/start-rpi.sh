#!/usr/bin/env bash
set -euo pipefail

# ── Charbot OS — RPi 5 Launcher ───────────────────────────────────────────
# Starts Ollama (if needed) and the Charbot OS server.
# Binds to 0.0.0.0 for LAN access from laptops/phones.

DRIVE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$DRIVE_ROOT/app"
VAULT_DIR="$DRIVE_ROOT/Vault"
OLLAMA_MODELS_DIR="$DRIVE_ROOT/ollama/models"
ENV_FILE="$APP_DIR/.env.local"
PORT=3000

# ── Export env vars ────────────────────────────────────────────────────────
export BIND_HOST=0.0.0.0              # LAN + localhost
export CHARBOT_VAULT_DIR="$VAULT_DIR"
export CHARBOT_MOBILE_DIR="$VAULT_DIR/MOBILE"
export OLLAMA_MODELS="$OLLAMA_MODELS_DIR"
export NODE_ENV=production
export CHARBOT_OFFLINE=true           # default: offline when run from SSD

# Load .env.local overrides (user config)
if [[ -f "$ENV_FILE" ]]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
fi

# ── Banner ─────────────────────────────────────────────────────────────────
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'unknown')"

echo ""
echo " ██████╗██╗  ██╗ █████╗ ██████╗ ██████╗  ██████╗ ████████╗"
echo "██╔════╝██║  ██║██╔══██╗██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝"
echo "██║     ███████║███████║██████╔╝██████╔╝██║   ██║   ██║   "
echo "██║     ██╔══██║██╔══██║██╔══██╗██╔══██╗██║   ██║   ██║   "
echo "╚██████╗██║  ██║██║  ██║██║  ██║██████╔╝╚██████╔╝   ██║   "
echo " ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝    ╚═╝  "
echo ""
echo "  RPi 5 Edition"
echo ""
echo "  Local:  http://localhost:$PORT"
echo "  LAN:    http://$LAN_IP:$PORT"
echo ""
echo "  Vault : $VAULT_DIR"
echo "  Ollama: $OLLAMA_MODELS_DIR"
if [[ "${CHARBOT_OFFLINE:-true}" == "true" ]]; then
  echo "  Mode  : [OFFLINE] — Cloud providers disabled"
else
  echo "  Mode  : [ONLINE]  — Cloud providers enabled"
fi
echo ""

# ── Check Node.js ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js not found. Run ./setup-rpi.sh first."
  exit 1
fi

# ── Check node_modules ────────────────────────────────────────────────────
if [[ ! -d "$APP_DIR/node_modules" ]]; then
  echo "[ERROR] node_modules not found. Run ./setup-rpi.sh first."
  exit 1
fi

# ── Vault dirs ─────────────────────────────────────────────────────────────
mkdir -p "$VAULT_DIR/uploads" "$VAULT_DIR/logs" "$VAULT_DIR/MOBILE"

# ── Start Ollama if not running ────────────────────────────────────────────
if ! curl -s http://localhost:11434/api/version &>/dev/null; then
  echo "[Ollama] Starting..."
  if command -v ollama &>/dev/null; then
    OLLAMA_MODELS="$OLLAMA_MODELS_DIR" ollama serve &
    sleep 3
    echo "[Ollama] Ready."
  else
    echo "[Ollama] WARNING: not found. Run ./setup-rpi.sh to install."
  fi
else
  echo "[Ollama] Already running."
fi

# ── Start server ───────────────────────────────────────────────────────────
echo "[Charbot] Starting on port $PORT... (Ctrl+C to stop)"
echo ""
exec node "$APP_DIR/dist-server/server.mjs"
