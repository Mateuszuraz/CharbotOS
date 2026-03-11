#!/usr/bin/env bash
set -euo pipefail

# ── Charbot OS — RPi 5 First-time Setup ───────────────────────────────────
# Run ONCE on Raspberry Pi after copying CharBotDrive-RPi/ to SSD.
# Installs Node.js (system-wide, not nvm) + Ollama ARM64 + compiles deps.

DRIVE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$DRIVE_ROOT/app"
OLLAMA_MODELS_DIR="$DRIVE_ROOT/ollama/models"
SERVICE_FILE="$DRIVE_ROOT/charbot-os.service"
NGROK_SERVICE_FILE="$DRIVE_ROOT/ngrok.service"

MODELS_TO_PULL=("llama3.2" "nomic-embed-text")

echo ""
echo "██████╗ ██████╗ ██╗    ███████╗███████╗████████╗██╗   ██╗██████╗ "
echo "██╔══██╗██╔══██╗██║    ██╔════╝██╔════╝╚══██╔══╝██║   ██║██╔══██╗"
echo "██████╔╝██████╔╝██║    ███████╗█████╗     ██║   ██║   ██║██████╔╝"
echo "██╔══██╗██╔═══╝ ██║    ╚════██║██╔══╝     ██║   ██║   ██║██╔═══╝ "
echo "██║  ██║██║     ██║    ███████║███████╗   ██║   ╚██████╔╝██║     "
echo "╚═╝  ╚═╝╚═╝     ╚═╝    ╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝     "
echo ""
echo "  Charbot OS — Raspberry Pi 5 Setup"
echo "  Drive: $DRIVE_ROOT"
echo ""

# ── [1/6] Node.js 20 LTS via NodeSource ───────────────────────────────────
# Using NodeSource (not nvm) so systemd can find node in PATH
if command -v node &>/dev/null && node --version | grep -qE '^v2[0-9]'; then
  echo "[1/6] Node.js $(node --version) found. OK"
else
  echo "[1/6] Installing Node.js 20 LTS via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  echo "[1/6] Node.js $(node --version) installed."
fi

# ── [2/6] Ollama ARM64 ────────────────────────────────────────────────────
if command -v ollama &>/dev/null; then
  echo "[2/6] Ollama $(ollama --version 2>/dev/null | head -1) found. OK"
else
  echo "[2/6] Installing Ollama (ARM64)..."
  curl -fsSL https://ollama.com/install.sh | sh
  echo "[2/6] Ollama installed."
fi

# ── [3/6] npm install (compiles better-sqlite3 for ARM64) ─────────────────
echo "[3/6] Installing Node.js dependencies (compiling native addons for ARM64)..."
echo "      This may take 3-5 minutes on first run..."
mkdir -p "$OLLAMA_MODELS_DIR"
mkdir -p "$DRIVE_ROOT/Vault/uploads" \
         "$DRIVE_ROOT/Vault/logs" \
         "$DRIVE_ROOT/Vault/MOBILE"
cd "$APP_DIR"
npm install --omit=dev --no-audit
echo "[3/6] Dependencies installed."
cd "$DRIVE_ROOT"

# ── [4/6] Pull AI models to SSD ───────────────────────────────────────────
echo "[4/6] Pulling AI models to SSD..."
echo "      Models: ${MODELS_TO_PULL[*]}"
echo "      (May take 5-15 minutes depending on internet speed)"
echo ""

export OLLAMA_MODELS="$OLLAMA_MODELS_DIR"

# Start Ollama temporarily for model pulling
if ! curl -s http://localhost:11434/api/version &>/dev/null; then
  OLLAMA_MODELS="$OLLAMA_MODELS_DIR" ollama serve &>/dev/null &
  OLLAMA_PID=$!
  echo "      Waiting for Ollama to start..."
  sleep 4
fi

for model in "${MODELS_TO_PULL[@]}"; do
  echo "      Pulling $model..."
  if OLLAMA_MODELS="$OLLAMA_MODELS_DIR" ollama pull "$model"; then
    echo "      ✓ $model"
  else
    echo "      ✗ $model (failed — check internet connection, you can re-run later)"
  fi
done

# Make launcher scripts executable
chmod +x "$DRIVE_ROOT/start-rpi.sh" "$DRIVE_ROOT/stop-rpi.sh" "$DRIVE_ROOT/get-url.sh" 2>/dev/null || true

# ── [5/6] Autostart (systemd) ─────────────────────────────────────────────
echo ""
echo "[5/6] Autostart configuration"
echo "      Charbot OS can start automatically when RPi boots."
echo ""
read -rp "      Enable autostart at boot? [Y/n]: " AUTOSTART
AUTOSTART="${AUTOSTART:-Y}"

MOUNT_PATH="$DRIVE_ROOT"
CURRENT_USER="${SUDO_USER:-$(whoami)}"

if [[ "$AUTOSTART" =~ ^[Yy]$ ]]; then
  echo ""
  echo "      Enter the full path where this SSD is mounted."
  echo "      Example: /media/pi/CharBot  or  /mnt/ssd"
  read -rp "      Mount path [$DRIVE_ROOT]: " MOUNT_PATH
  MOUNT_PATH="${MOUNT_PATH:-$DRIVE_ROOT}"

  # Substitute placeholders in service template
  TMP_SERVICE="/tmp/charbot-os.service"
  sed \
    -e "s|__SSD_PATH__|$MOUNT_PATH|g" \
    -e "s|__USER__|$CURRENT_USER|g" \
    "$SERVICE_FILE" > "$TMP_SERVICE"

  sudo cp "$TMP_SERVICE" /etc/systemd/system/charbot-os.service
  sudo systemctl daemon-reload
  sudo systemctl enable charbot-os
  sudo systemctl start charbot-os

  echo ""
  echo "      ✓ Autostart enabled."
  echo "      Charbot OS is now running as a system service."
  echo "      Check status: sudo systemctl status charbot-os"
  echo "      View logs:    sudo journalctl -u charbot-os -f"
else
  echo ""
  echo "      Autostart skipped. Run ./start-rpi.sh manually to start Charbot OS."
fi

# ── [6/6] ngrok tunnel (optional) ─────────────────────────────────────────
echo ""
echo "[6/6] ngrok — public HTTPS tunnel"
echo "      Lets you access Charbot OS from anywhere via a public URL."
echo "      Requires a free ngrok account: https://ngrok.com"
echo ""
read -rp "      Configure ngrok tunnel? [Y/n]: " SETUP_NGROK
SETUP_NGROK="${SETUP_NGROK:-Y}"

if [[ "$SETUP_NGROK" =~ ^[Yy]$ ]]; then

  # Install ngrok (ARM64) via official apt repo
  if command -v ngrok &>/dev/null; then
    echo "      ngrok $(ngrok version 2>/dev/null | head -1) found. OK"
  else
    echo "      Installing ngrok (ARM64)..."
    curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
      | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
    echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
      | sudo tee /etc/apt/sources.list.d/ngrok.list
    sudo apt-get update -qq
    sudo apt-get install -y ngrok
    echo "      ✓ ngrok installed."
  fi

  # Configure authtoken
  echo ""
  echo "      Go to https://dashboard.ngrok.com/get-started/your-authtoken"
  echo "      Copy your authtoken and paste it below."
  read -rp "      ngrok authtoken: " NGROK_TOKEN

  if [[ -n "$NGROK_TOKEN" ]]; then
    ngrok config add-authtoken "$NGROK_TOKEN"

    # Write ngrok tunnel config
    NGROK_CFG="$HOME/.config/ngrok/ngrok.yml"
    mkdir -p "$(dirname "$NGROK_CFG")"
    cat > "$NGROK_CFG" <<EOF
version: "3"
agent:
  authtoken: $NGROK_TOKEN
tunnels:
  charbot:
    proto: http
    addr: 3000
EOF
    echo "      ✓ ngrok config written to $NGROK_CFG"

    # Install ngrok as systemd service (after charbot-os)
    if [[ "$AUTOSTART" =~ ^[Yy]$ ]] && [[ -f "$NGROK_SERVICE_FILE" ]]; then
      TMP_NGROK="/tmp/ngrok.service"
      sed \
        -e "s|__USER__|$CURRENT_USER|g" \
        -e "s|__HOME__|$HOME|g" \
        "$NGROK_SERVICE_FILE" > "$TMP_NGROK"

      sudo cp "$TMP_NGROK" /etc/systemd/system/ngrok.service
      sudo systemctl daemon-reload
      sudo systemctl enable ngrok
      sudo systemctl start ngrok

      echo "      ✓ ngrok service enabled (starts after charbot-os)."
      echo "      Get public URL: ./get-url.sh"
      echo "      View logs:      sudo journalctl -u ngrok -f"
    else
      echo ""
      echo "      ngrok service NOT installed (autostart was skipped)."
      echo "      To start ngrok manually: ngrok start charbot"
      echo "      To get the URL:          ./get-url.sh"
    fi
  else
    echo "      Authtoken skipped — you can configure ngrok later:"
    echo "      ngrok config add-authtoken YOUR_TOKEN"
    echo "      ngrok start charbot"
  fi
else
  echo ""
  echo "      ngrok skipped."
  echo "      To set it up later: ngrok config add-authtoken TOKEN && ngrok http 3000"
fi

# ── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
echo " Setup complete!"
echo ""
echo " To start manually:    ./start-rpi.sh"
echo " To stop:              ./stop-rpi.sh"
echo " Current ngrok URL:    ./get-url.sh"
echo " Configuration:        app/.env.local  (copy from .env.local.example)"
echo " Full instructions:    README_RPi.md"
echo "══════════════════════════════════════════════"
echo ""
