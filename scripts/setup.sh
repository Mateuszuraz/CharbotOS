#!/usr/bin/env bash
set -euo pipefail

DRIVE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$DRIVE_ROOT/app"
OLLAMA_DIR="$DRIVE_ROOT/ollama"
OLLAMA_MODELS_DIR="$OLLAMA_DIR/models"

# Models to pre-download onto the SSD (edit to change the bundle)
MODELS_TO_PULL=("llama3.2" "nomic-embed-text")

echo ""
echo "CHARBOT OS — SETUP"
echo "=================="
echo "Drive: $DRIVE_ROOT"
echo ""

# ── Node.js ────────────────────────────────────────────────────────────────
if command -v node &>/dev/null; then
  echo "[1/4] Node.js $(node --version) found. OK"
else
  echo "[1/4] Installing Node.js via nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  # shellcheck disable=SC1090
  source "$HOME/.nvm/nvm.sh"
  nvm install --lts
  echo "[1/4] Node.js installed."
fi

# ── Ollama ─────────────────────────────────────────────────────────────────
if command -v ollama &>/dev/null; then
  echo "[2/4] Ollama $(ollama --version) found. OK"
elif [[ -x "$OLLAMA_DIR/ollama" ]]; then
  echo "[2/4] Using bundled Ollama binary."
  export PATH="$OLLAMA_DIR:$PATH"
else
  echo "[2/4] Installing Ollama..."
  mkdir -p "$OLLAMA_DIR"
  curl -fsSL https://ollama.com/install.sh | sh
  echo "[2/4] Ollama installed."
fi

# ── Vault structure ────────────────────────────────────────────────────────
echo "[3/4] Creating Vault..."
mkdir -p "$DRIVE_ROOT/Vault/uploads" \
         "$DRIVE_ROOT/Vault/logs" \
         "$DRIVE_ROOT/Vault/MOBILE" \
         "$OLLAMA_MODELS_DIR"

# ── Pull models to SSD ─────────────────────────────────────────────────────
echo "[4/4] Pulling AI models to SSD..."
echo "      Models: ${MODELS_TO_PULL[*]}"
echo "      (May take several minutes on first run)"
echo ""

export OLLAMA_MODELS="$OLLAMA_MODELS_DIR"

# Start Ollama service for pulling
if ! curl -s http://localhost:11434/api/version &>/dev/null; then
  ollama serve &>/dev/null &
  sleep 3
fi

for model in "${MODELS_TO_PULL[@]}"; do
  echo "      Pulling $model..."
  if ollama pull "$model"; then
    echo "      ✓ $model"
  else
    echo "      ✗ $model (failed — check internet connection)"
  fi
done

# Make scripts executable
chmod +x "$DRIVE_ROOT/start.sh" "$DRIVE_ROOT/setup.sh" 2>/dev/null || true

echo ""
echo "══════════════════════════════════════"
echo "Setup complete!"
echo ""
echo "Edit $APP_DIR/.env.local to configure API keys (optional)"
echo "Run ./start.sh to launch Charbot OS."
echo "══════════════════════════════════════"
echo ""
