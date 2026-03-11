#!/usr/bin/env bash
# ── Charbot OS — RPi Stop Script ──────────────────────────────────────────
# Stops the Charbot OS server process.
# Does NOT kill Ollama (it may be used by other processes).

pkill -f "dist-server/server.mjs" 2>/dev/null && echo "[Charbot] Server stopped." || echo "[Charbot] Server was not running."
