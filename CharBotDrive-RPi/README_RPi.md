# Charbot OS — Raspberry Pi 5 (SSD Edition)

## Wymagania
- Raspberry Pi 5 (4 GB RAM lub więcej)
- SSD podłączony przez USB 3 lub PCIe (zalecane NVMe)
- Dostęp do internetu podczas pierwszej konfiguracji

---

## Instalacja (jednorazowo)

1. Skopiuj cały folder `CharBotDrive-RPi/` na SSD.
2. Zamontuj SSD na RPi (np. `/media/pi/CharBot`).
3. Otwórz terminal i uruchom:

```bash
cd /media/pi/CharBot
chmod +x setup-rpi.sh && ./setup-rpi.sh
```

Skrypt:
- Instaluje Node.js 20 LTS (via NodeSource)
- Instaluje Ollama (ARM64)
- Kompiluje `better-sqlite3` dla ARM64 (`npm install` w `app/`)
- Pobiera modele: `llama3.2` i `nomic-embed-text`
- (Opcjonalnie) konfiguruje autostart przy każdym uruchomieniu RPi
- (Opcjonalnie) instaluje ngrok i konfiguruje publiczny tunel HTTPS

---

## Codzienne użycie

### Ręcznie:
```bash
./start-rpi.sh      # uruchom serwer
./stop-rpi.sh       # zatrzymaj serwer
```

### Dostęp:
- **Na RPi:** `http://localhost:3000`
- **Z laptopa/telefonu w sieci LAN:** `http://192.168.x.x:3000`
  (IP wyświetla się w bannerze przy starcie)

### Autostart (systemd):
Jeśli wybrałeś autostart w trakcie `setup-rpi.sh`:
```bash
sudo systemctl status charbot-os   # sprawdź status
sudo systemctl restart charbot-os  # restart
sudo systemctl stop charbot-os     # zatrzymaj
sudo journalctl -u charbot-os -f   # logi na żywo
```

---

## Zdalny dostęp przez ngrok (24/7)

ngrok tworzy publiczny adres HTTPS dla twojego Charbota — dostępny z dowolnego miejsca na świecie.

### Wymagania
- Darmowe konto na https://ngrok.com
- Authtoken z https://dashboard.ngrok.com/get-started/your-authtoken

### Konfiguracja (setup-rpi.sh pyta o to automatycznie)
```bash
ngrok config add-authtoken TWÓJ_TOKEN
```

### Sprawdzenie publicznego URL
```bash
./get-url.sh
```

### Status usługi ngrok
```bash
sudo systemctl status ngrok          # sprawdź status
sudo systemctl restart ngrok         # restart
sudo journalctl -u ngrok -f          # logi na żywo
```

### Ręczne uruchomienie (bez autostartu)
```bash
ngrok start charbot                  # uruchom tunel
./get-url.sh                         # sprawdź URL
```

---

## Konfiguracja

Skopiuj `.env.local.example` do `app/.env.local`:
```bash
cp .env.local.example app/.env.local
nano app/.env.local
```

Kluczowe opcje:
- `CHARBOT_OFFLINE=false` — włącza dostawców chmurowych (OpenAI, Anthropic, Google)
- `BIND_HOST=0.0.0.0` — serwer dostępny z sieci LAN (domyślnie włączone)

---

## Dane użytkownika (Vault)

Wszystkie dane zapisywane są w `./Vault/`:
- `Vault/uploads/` — przesłane pliki i obrazy
- `Vault/logs/` — logi aplikacji (rotacja po 5 MB)
- `Vault/MOBILE/` — mobilny portal
- `Vault/app-secret.txt` — token bezpieczeństwa (auto-generowany)
- `Vault/ai-keys.json` — klucze API dostawców chmurowych

---

## Modele Ollama

Modele przechowywane są w `./ollama/models/` — bezpośrednio na SSD.
Aby pobrać dodatkowy model:
```bash
OLLAMA_MODELS=/media/pi/CharBot/ollama/models ollama pull mistral
```

---

## Rozwiązywanie problemów

**Serwer nie startuje:**
```bash
node --version        # musi być >= 20
ollama --version      # musi być dostępne
ls app/node_modules   # musi istnieć — jeśli nie: cd app && npm install
```

**Nie można połączyć z LAN:**
- Sprawdź IP: `hostname -I | awk '{print $1}'`
- Upewnij się że `BIND_HOST=0.0.0.0` w `app/.env.local`
- Sprawdź firewall: `sudo ufw allow 3000/tcp`

**Reset danych:**
```bash
rm -rf Vault/          # usuwa wszystkie dane — nieodwracalne!
mkdir -p Vault/{uploads,logs,MOBILE}
```
