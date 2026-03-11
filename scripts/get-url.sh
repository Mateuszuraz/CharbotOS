#!/usr/bin/env bash
# ── Charbot OS — Show current ngrok public URL ────────────────────────────
# Queries the ngrok local API (port 4040) for active tunnels.

if ! curl -s http://localhost:4040/api/tunnels >/dev/null 2>&1; then
  echo ""
  echo "  [ERROR] ngrok is not running."
  echo "  Start it with:  ngrok start charbot"
  echo "  Or via systemd: sudo systemctl start ngrok"
  echo ""
  exit 1
fi

echo ""
python3 - <<'EOF'
import urllib.request, json, sys

try:
    with urllib.request.urlopen("http://localhost:4040/api/tunnels", timeout=3) as r:
        data = json.load(r)
    tunnels = data.get("tunnels", [])
    if not tunnels:
        print("  No active tunnels found.")
        sys.exit(1)
    print("  ╔══════════════════════════════════════════════╗")
    print("  ║  Charbot OS — Public URL                     ║")
    print("  ╠══════════════════════════════════════════════╣")
    for t in tunnels:
        name = t.get("name", "tunnel")
        url  = t.get("public_url", "?")
        print(f"  ║  {name:<10} → {url:<30} ║")
    print("  ╚══════════════════════════════════════════════╝")
except Exception as e:
    print(f"  Error: {e}")
    sys.exit(1)
EOF
echo ""
