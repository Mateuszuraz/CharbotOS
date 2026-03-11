# CharBot Drive

## First time setup
Run SETUP.bat (Windows) or ./setup.sh (Linux/Mac).
This will install Ollama and pull the bundled AI models.

## Daily use
Run START.bat (Windows) or ./start.sh (Linux/Mac).
The browser opens automatically at http://localhost:3000.

## Vault
All your data (sessions, uploads, mobile portal) is stored in ./Vault/
on this drive — never on the host machine.

## Offline Mode
The app starts in OFFLINE mode by default when launched from this drive.
To allow cloud providers, edit ./app/.env.local and set CHARBOT_OFFLINE=false.
