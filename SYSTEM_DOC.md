# Charbot OS — Dokumentacja Systemowa

> Wersja: 2.2 | Data: 2026-03-06 | Środowisko: Electron 40 / Node.js / React 19

---

## 1. Czym jest Charbot OS

Charbot OS to lokalna, desktopowa aplikacja AI uruchamiana jako instalator Windows (NSIS/Electron). Działa w pełni offline (z lokalnymi modelami Ollama) lub jako proxy do chmurowych API (OpenAI, Anthropic, Google Gemini, Groq, Mistral, xAI). Cała logika serwera działa na `127.0.0.1:3000` — dane użytkownika nigdy nie opuszczają maszyny, chyba że jawnie wywoła model chmurowy.

Aplikacja łączy w sobie:
- **Interfejs czatu** z wieloma sesjami, modelami i trybami
- **System automatyzacji** (Flow Editor — wizualny edytor przepływów)
- **Galerię** wygenerowanych mediów
- **Agenta systemu plików** (OS File Agent) z sandbox
- **Scheduler** zadań cyklicznych
- **System wtyczek** (MJS + Webhook)
- **Bazę wiedzy RAG** (embeddingi lokalne)
- **Multiroom** (wiele osób, wiele modeli, jeden pokój czatu w czasie rzeczywistym)
- **Boty** Telegram i Discord
- **Mobilny portal** (podgląd sesji na telefonie)

---

## 2. Architektura techniczna

### 2.1 Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Desktop shell | Electron 40.6.1 |
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS v4 |
| Backend | Node.js (ESM), Express 4, better-sqlite3 |
| Baza danych | SQLite (plik `CharbotVault/charbot.db`) |
| Animacje | Framer Motion (`motion/react`) |
| Flow Editor | ReactFlow |
| Ikony | Lucide React |
| WebSocket | `ws` (multiroom) |
| Harmonogram | `node-cron` |
| PDF | pdfjs-dist |

### 2.2 Struktura katalogów

```
charbot-os/
├── electron/
│   ├── main.ts          # Electron main process — ładuje server bundle, otwiera okno
│   └── preload.ts       # Preload script (contextIsolation)
├── server/
│   ├── aiKeys.ts        # Zarządzanie kluczami API (Vault/ai-keys.json)
│   ├── discord.ts       # Bot Discord
│   ├── documents.ts     # System dokumentów (generowanie HTML/PDF)
│   ├── mobile.ts        # Mobilny portal (serwowanie sesji na /mobile)
│   ├── osAgent.ts       # OS File Agent — sandbox operacji na plikach
│   ├── pluginLoader.ts  # Ładowanie wtyczek (MJS + Webhook)
│   ├── rag.ts           # RAG — embeddingi i wyszukiwanie semantyczne
│   ├── rooms.ts         # Multiroom — WebSocket, AI dispatch
│   ├── scheduler.ts     # Harmonogram zadań (node-cron)
│   ├── telegram.ts      # Bot Telegram
│   └── vault.ts         # Vault dirs, logi z rotacją
├── src/
│   ├── components/      # Komponenty React (UI)
│   ├── context/         # Konteksty React (Settings, Session, Room, Language)
│   ├── hooks/           # useLocalChat, useStreamingChat
│   ├── lib/             # osToolDefs, utils
│   └── types/           # TypeScript interfaces
├── server.ts            # Główny serwer Express — wszystkie endpointy
├── scripts/
│   ├── build-electron.mjs  # Pipeline buildu: Vite → esbuild → @electron/rebuild → electron-builder
│   └── build-server.mjs    # esbuild: server.ts → dist-server/server.mjs
└── CharbotVault/        # Katalog danych użytkownika (poza folderem aplikacji)
    ├── charbot.db       # Baza SQLite
    ├── app-secret.txt   # Token lokalnego uwierzytelnienia
    ├── ai-keys.json     # Klucze API do chmury
    ├── logs/            # Logi aplikacji (rotacja po 5 MB)
    ├── uploads/         # Wgrane pliki (obrazy, PDF, CSV)
    ├── mobile/          # Wygenerowane strony mobilne sesji
    └── plugins/         # Wtyczki użytkownika (*.mjs)
```

### 2.3 Przepływ uruchamiania (Electron)

1. `electron/main.ts` ustawia `NODE_ENV=production`
2. Ładuje `dist-server/server.mjs` przez `await import(pathToFileURL(serverPath))`
3. `server.mjs` uruchamia `await startServer()` (top-level await w ESM)
4. `startServer()` inicjalizuje Vault → DB → tabele → Express → HTTP server → nasłuchuje na `127.0.0.1:3000`
5. Po sukcesie `import()` wraca → main.ts weryfikuje HTTP ping (`/api/config`) max 5 s
6. Otwiera `BrowserWindow` → ładuje `http://127.0.0.1:3000`

---

## 3. Schemat bazy danych (SQLite)

### Tabele główne

| Tabela | Opis |
|--------|------|
| `sessions` | Sesje czatu (id, title, model, createdAt) |
| `messages` | Wiadomości sesji (id, sessionId, role, content, timestamp) |
| `rag_embeddings` | Embeddingi RAG (id, sessionId, chunkText, embedding BLOB, createdAt) |
| `scheduled_tasks` | Zadania harmonogramu (id, name, type, cronExpr, config JSON, enabled, lastRunAt, lastResult) |
| `rooms` | Pokoje multiroom (id, name, mode, password, debateTopicPro, debateTopicCon) |
| `room_participants` | Uczestnicy pokoi (id, roomId, username, color, model, isActive) |
| `room_messages` | Wiadomości w pokojach (id, roomId, authorId, authorName, authorType, model, content) |

### Limity
- Maksymalnie **50 sesji** w historii (LIMIT 50 w zapytaniach)
- Załączniki (obrazy) **nie są przechowywane** w DB — tylko metadane; surowe base64 jest usuwane przy sync

---

## 4. API Endpointy (serwer Express)

Wszystkie endpointy `/api/*` wymagają nagłówka `X-App-Secret` (oprócz `/api/init` i `/api/config`).

### 4.1 Konfiguracja i inicjalizacja

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/api/init` | Zwraca `appSecret` — wywoływane raz przez frontend przy starcie |
| GET | `/api/config` | Publiczny — zwraca wersję, tryb offline, dostępne providery |

### 4.2 Sesje i wiadomości

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/api/sessions` | Lista sesji (max 50) |
| POST | `/api/sessions` | Utwórz nową sesję |
| GET | `/api/sessions/:id` | Pobierz sesję z wiadomościami |
| DELETE | `/api/sessions/:id` | Usuń sesję |
| POST | `/api/sessions/sync` | Synchronizuj wiadomości sesji do DB |

### 4.3 AI — lokalne i chmurowe

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/api/ollama/chat` | Streaming chat z lokalnym Ollama (SSE) |
| GET | `/api/ollama/models` | Lista lokalnych modeli |
| POST | `/api/ollama/vision` | Analiza obrazu (vision models) |
| POST | `/api/ai/chat` | Proxy do chmury — SSE streaming (OpenAI, Anthropic, Gemini, Groq, Mistral, xAI) |
| GET | `/api/ai/models` | Lista modeli chmurowych |
| GET | `/api/ai/keys` | Pobierz zamaskowane klucze API |
| POST | `/api/ai/keys` | Zapisz/aktualizuj klucze API |

### 4.4 OS File Agent

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/api/agent/run` | Wykonaj krok agenta (tool call lub odpowiedź) |

### 4.5 Dokumenty

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/api/documents` | Lista wygenerowanych dokumentów |
| POST | `/api/documents/generate` | Generuj dokument HTML/PDF z sesji |
| GET | `/api/documents/:id` | Pobierz dokument |
| DELETE | `/api/documents/:id` | Usuń dokument |

### 4.6 Pliki i upload

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/api/upload` | Upload pliku (obraz, PDF, CSV, JSON, XLS) |
| GET | `/uploads/:filename` | Serwuj plik statyczny |

### 4.7 Mobilny portal

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/api/mobile/generate` | Generuj portal mobilny dla sesji |
| GET | `/mobile` | Lista sesji (strona mobilna) |
| GET | `/mobile/:sessionId` | Portal mobilny konkretnej sesji |

### 4.8 Telegram i Discord (konfiguracja)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/api/telegram/config` | Zapisz token bota + whitelist |
| GET | `/api/telegram/config` | Pobierz konfigurację |
| POST | `/api/discord/config` | Zapisz token bota + guild whitelist |

### 4.9 RAG / Baza wiedzy

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/api/rag/index` | Zaindeksuj sesję (generuj embeddingi) |
| POST | `/api/rag/search` | Wyszukaj semantycznie (zwraca top-k chunks) |
| GET | `/api/rag/list` | Lista zaindeksowanych sesji z liczbą chunków |
| POST | `/api/rag/index-file` | Zaindeksuj plik z Vault/uploads |
| POST | `/api/rag/clear` | Wyczyść indeks (per-sesja lub wszystko) |

### 4.10 Scheduler

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/api/scheduler/tasks` | Lista zadań |
| POST | `/api/scheduler/tasks` | Utwórz zadanie + zarejestruj cron job |
| PUT | `/api/scheduler/tasks/:id` | Aktualizuj / toggle enabled |
| DELETE | `/api/scheduler/tasks/:id` | Usuń zadanie |
| POST | `/api/scheduler/tasks/:id/run` | Uruchom natychmiast → `{result}` |

### 4.11 Plugins

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/api/plugins` | Lista załadowanych wtyczek |
| POST | `/api/plugins/reload` | Hot-reload z dysku |
| POST | `/api/plugins/exec/:name` | Wywołaj wtyczkę `{args}` → `{result}` |
| POST | `/api/plugins/webhook` | Utwórz webhook tool |
| DELETE | `/api/plugins/webhook/:name` | Usuń webhook tool |

### 4.12 Multiroom

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/api/rooms` | Lista pokoi |
| POST | `/api/rooms` | Utwórz pokój |
| GET | `/api/rooms/:id` | Pobierz pokój + uczestników |
| POST | `/api/rooms/:id/join` | Dołącz do pokoju (zwraca participantId) |
| GET | `/api/rooms/:id/messages` | Historia wiadomości pokoju |
| DELETE | `/api/rooms/:id` | Usuń pokój |
| WS | `/ws/room/:id?secret=...&participantId=...` | WebSocket — real-time komunikacja |

---

## 5. Funkcje — szczegółowy opis

### 5.1 Czat i sesje

- **Wielosesyjność**: nieograniczona liczba sesji, historia ostatnich 50 w panelu bocznym
- **Streaming**: tokeny AI przychodzą w czasie rzeczywistym (SSE dla chmury, fetch streaming dla Ollama)
- **Role wiadomości**: `user`, `assistant`, `system`
- **Persona**: własna nazwa bota, poziom ograniczeń (standard / minimal / none), custom system prompt
- **Tryb offline**: `CHARBOT_OFFLINE=true` blokuje wszystkie endpointy `/api/ai/*` → tylko Ollama
- **Markdown rendering**: pełne wsparcie (kod, tabele, listy, nagłówki, inline code)
- **Kod**: bloki kodu z ciemnym tłem (#1a1a1a) i jasną czcionką — czytelne
- **Szablony**: biblioteka gotowych promptów (TemplateLibrary panel)

### 5.2 OS File Agent

Agent systemu plików działający w obrębie sandboxu katalogów dozwolonych przez użytkownika.

**Narzędzia agenta:**

| Tool | Opis |
|------|------|
| `list_dir` | Lista plików i katalogów w ścieżce |
| `search_files` | Wyszukaj pliki po nazwie/rozszerzeniu |
| `read_file` | Odczytaj zawartość pliku (tekstowego) |
| `write_file` | Zapisz/utwórz plik |
| `append_csv` | Dołącz wiersze do pliku CSV |

**Bezpieczeństwo:**
- Walidacja ścieżki (`validatePath`) — sprawdza czy cel mieści się w `allowedDirs`
- Sprawdzenie symlinków (`fs.realpath`) — blokuje atak traversal przez dowiązania symboliczne
- Pętla agentic max **5 iteracji** — zapobiega nieskończonym pętlom
- `ENABLE_EXEC=true` wymagane dla komend shell (domyślnie wyłączone)

### 5.3 Flow Editor (Automatyzacja)

Wizualny edytor przepływów oparty na ReactFlow. Umożliwia budowanie pipeline'ów AI bez kodu:
- Węzły: Prompt, LLM, Warunek, Output, Transform
- Połączenia między węzłami reprezentują przepływ danych
- Zapis i odtwarzanie przepływów

### 5.4 Scheduler (Harmonogram zadań)

Zadania cykliczne zdefiniowane przez użytkownika, wykonywane według wyrażenia cron.

**Typy zadań:**

| Typ | Opis |
|-----|------|
| `prompt_telegram` | Wyślij prompt do modelu Ollama → wynik przez Telegram |
| `export_session` | Wygeneruj portal mobilny sesji → wyślij link przez Telegram |
| `os_agent` | Wykonaj polecenie OS Agenta → wynik przez Telegram |

**Format czasu:** picker HH:MM + checkboxy dni tygodnia → konwersja na cron expression.

Przykład: `08:00, Pon-Pt` → `0 8 * * 1,2,3,4,5`

### 5.5 System wtyczek

**Typ A — Wtyczka plikowa (MJS):**
Plik `CharbotVault/plugins/moja_wtyczka.mjs` z eksportami:
```javascript
export const name = 'nazwa_narzedzia';
export const description = 'Co robi to narzędzie.';
export const parameters = { query: 'string — opis parametru' };
export async function execute(args, ctx) {
  // ctx = { allowedDirs, vaultDir }
  return 'wynik jako string';
}
```

**Typ B — Webhook tool (JSON):**
Plik `CharbotVault/plugins-webhook.json` lub tworzony przez UI:
```json
[{
  "name": "pogoda",
  "description": "Sprawdza pogodę dla miasta.",
  "parameters": { "city": "string — nazwa miasta" },
  "url": "https://wttr.in/{city}?format=3",
  "method": "GET"
}]
```

**Integracja z agentem:**
- Wtyczki automatycznie pojawiają się w liście narzędzi modelu
- Model wywołuje je tak samo jak wbudowane narzędzia OS Agenta
- Wynik wyświetlany w `ToolCallBubble` w interfejsie

### 5.6 RAG — Retrieval Augmented Generation

System semantycznego wyszukiwania oparty na lokalnych embeddingach Ollama.

**Jak działa:**
1. Tekst sesji/pliku dzielony na chunki (ok. 500 tokenów)
2. Każdy chunk embedding-owany lokalnym modelem (np. `nomic-embed-text`)
3. Przy zapytaniu: embedding pytania → cosine similarity → top-k chunków → dołączane do kontekstu

**Kiedy RAG jest aktywny:**
- Ustawienie `ragEnabled: true` w SettingsPanel
- Model embeddingów wybrany w `ragModel`
- Przy każdym zapytaniu frontend sprawdza podobieństwo do zaindeksowanych treści

### 5.7 Multiroom

Wiele osób pracuje równocześnie w jednym pokoju czatu z różnymi modelami AI.

**Tryby pracy AI:**

| Tryb | Opis |
|------|------|
| `own_model` | Każdy uczestnik ma swój model — AI odpowiada tylko na wiadomości swojego właściciela |
| `panel` | Wszystkie modele odpowiadają sekwencyjnie na każdą wiadomość |
| `mention` | Model odpowiada tylko gdy jest wspomniany: `@nazwaModelu pytanie` |
| `debate` | Dwa modele prowadzą debatę pro/con na zadany temat |

**Protokół WebSocket:**

Zdarzenia serwera → klient:
- `presence` — lista uczestników z ich statusem online
- `join` / `leave` — uczestnik dołącza/wychodzi
- `message` — nowa wiadomość ludzka
- `ai_start` / `ai_token` / `ai_done` — streaming odpowiedzi AI
- `system` — komunikat systemowy

Zdarzenia klient → serwer:
- `message` — wyślij wiadomość `{type: 'message', content: '...'}`
- `ping` — keepalive co 30s

### 5.8 Gallery (Galeria)

Przeglądarka wygenerowanych obrazów i dokumentów z Vault/uploads. Filtry, podgląd, pobieranie.

### 5.9 Mobilny portal

Sesje czatu dostępne na telefonie przez lokalną sieć (ten sam router):
- `http://[IP_KOMPUTERA]:3000/mobile` — lista sesji
- `http://[IP_KOMPUTERA]:3000/mobile/:sessionId` — konkretna sesja
- Statyczne strony HTML z historią wiadomości — brak JS frameworku dla lekkości

---

## 6. Bezpieczeństwo

### 6.1 Architektura bezpieczeństwa

| ID | Zabezpieczenie | Szczegóły |
|----|----------------|-----------|
| P0-1 | Shell exec wyłączony | `POST /api/terminal/exec` → 403 bez `ENABLE_EXEC=true` |
| P0-2 | Brak surowego /api/fs | Dostęp do plików wyłącznie przez OS Agent z walidacją |
| P0-3 | Limit 50 sesji | `SELECT ... LIMIT 50` w DB — zapobiega bloatem |
| P0-4 | Telegram whitelist | Pusta lista = odmów wszystkim; tylko jawnie dozwolone ID |
| P0-5 | Klucze API w Vault | `ai-keys.json` poza folderem aplikacji; zero kluczy w przeglądarce |
| P0-6 | Offline middleware | `/api/ai/*` → 403 gdy `CHARBOT_OFFLINE=true` |
| P0-7 | Brak base64 w DB | `strip` base64 przy sync; jednorazowa migracja starych wpisów |
| P0-8 | Bind 127.0.0.1 | Serwer słucha tylko localhost (env `BIND_HOST` do nadpisania) |
| P0-9 | Fine-tuning off | `/api/ollama/create-model` → 403 bez `ENABLE_FINE_TUNE=true` |
| P0-11 | APP_SECRET | Token 32-bajtowy hex, generowany przy starcie, przechowywany w Vault; wszystkie `/api/*` wymagają nagłówka `X-App-Secret` |
| P1-4 | XSS escape | HTML escape w `documents.ts` `wrapHtml()` — brak możliwości injection |
| P1-5 | Log rotation | Logi obcinane po 5 MB — zapobiega zapełnieniu dysku |
| P1-6 | Vision allowlist | Tylko modele z listy (llava, qwen2.5vl, moondream, ...) mogą przetwarzać obrazy |
| P2 | Rate limiting | `/api/ai/*`: 40 req/min; `/api/upload`: 20 req/min; `/api/*`: 60 req/min |
| P2 | MIME allowlist | Upload odrzuca pliki poza listą (JPEG, PNG, GIF, WebP, PDF, TXT, CSV, MD, JSON, XLS, ODS) |
| P2 | Symlink check | `fs.realpath()` przed prefix check w `validatePath()` — blokuje traversal przez symlinki |

### 6.2 Tryb Persona/Uncensored

- `restrictionLevel: 'standard'` — domyślne ograniczenia modelu
- `restrictionLevel: 'minimal'` — minimalny system prompt, model mniej ograniczony
- `restrictionLevel: 'none'` — brak systemowego filtru (wymaga `CHARBOT_UNCENSORED=true` env + ostrzeżenie w UI)

---

## 7. Boty (Telegram i Discord)

### 7.1 Bot Telegram

Konfigurowany w Ustawieniach → zakładka Telegram.

**Komendy:**

| Komenda | Opis |
|---------|------|
| `/chat [tekst]` | Wyślij wiadomość do aktywnej sesji |
| `/ask [model] [pytanie]` | Zapytaj konkretny model Ollama |
| `/export [id_sesji]` | Wyeksportuj sesję jako portal mobilny |
| `/search [fraza]` | Wyszukaj w historii sesji |
| `/photo` | Wyślij zdjęcie do analizy vision |

**Bezpieczeństwo:** Whitelist Telegram ID — bot odpowiada tylko na wiadomości z autoryzowanych kont.

### 7.2 Bot Discord

Konfigurowany w Ustawieniach → zakładka Discord.

**Prefix:** `!cb`

**Komendy:**

| Komenda | Opis |
|---------|------|
| `!cb chat [tekst]` | Chat z domyślnym modelem |
| `!cb ask [model] [tekst]` | Zapytaj konkretny model |
| `!cb export [id]` | Eksportuj sesję (pliki z Vault) |

**Bezpieczeństwo:** Whitelist Guild ID — bot odpowiada tylko na serwery jawnie dozwolone.

---

## 8. Interfejs użytkownika

### 8.1 Nawigacja

Wąski sidebar z ikonami po lewej:
- **Chat** (MessageSquare) — główny widok czatu
- **Flows** (Workflow) — edytor automatyzacji
- **Sessions** (PanelLeft) — panel sesji (tylko w widoku czatu)
- **Templates** (BookOpen) — biblioteka szablonów (tylko w widoku czatu)
- **Gallery** (Images) — galeria mediów
- **Tutorial** (GraduationCap) — tryb samouczka z podpowiedziami
- **Theme** — przełącznik motywu (Light/Dark/System)
- **Settings** (Settings) — panel ustawień

### 8.2 Panel ustawień — zakładki

| Zakładka | Zawartość |
|----------|-----------|
| Model | Wybór providera (Ollama/Chmura), endpointy, model domyślny |
| Parameters | Temperature, top-p, max tokens, presence/frequency penalty |
| Prompt | Systemowy prompt, tryb persony, poziom ograniczeń |
| Vision | Włącz/wyłącz vision, wybór modelu vision |
| Telegram | Token bota, whitelist ID |
| Discord | Token bota, whitelist Guild ID |
| Language | PL / EN |
| Persona | Nazwa, charakter, zachowanie bota |
| Agent | Włącz OS File Agent, dozwolone katalogi |
| RAG | Włącz/wyłącz, model embeddingów, Knowledge Base panel |
| Scheduler | Lista zadań, formularz tworzenia zadania |
| Plugins | Lista wtyczek (plikowe + webhook), formularz tworzenia webhook |

### 8.3 Tematy wizualne

System oparty na CSS Custom Properties (Tailwind v4):
- **Light** — jasne tło, ciemny tekst
- **Dark** — ciemne tło z dekoracyjnym tłem (bg-dark.png, mix-blend-mode: screen)
- **System** — automatycznie według preferencji OS

Design "Ink System v2.0" — minimalistyczny, monochromatyczny, inspirowany drukiem offsetowym.

### 8.4 Onboarding

Przy pierwszym uruchomieniu: 3-krokowy wizard:
1. Konfiguracja Vault (sprawdzenie/zmiana ścieżki)
2. Wybór providera AI i test połączenia
3. Testowy czat

### 8.5 Tutorial

Tryb samouczka (`tutorialEnabled: true`) wyświetla tooltipe przy elementach UI objaśniające ich funkcję. Klucze tutorialu: `nav_chat`, `nav_flows`, `nav_sessions`, `nav_templates`, `nav_gallery`, `nav_tutorial`, `nav_theme`, `nav_settings`.

---

## 9. Zmienne środowiskowe

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `BIND_HOST` | `127.0.0.1` | IP, na którym serwer nasłuchuje |
| `CHARBOT_OFFLINE` | `false` | `true` = blokuj chmurowe API |
| `ENABLE_EXEC` | brak | Ustaw `true` aby odblokować exec shell |
| `ENABLE_FINE_TUNE` | brak | Ustaw `true` aby odblokować fine-tuning Ollama |
| `CHARBOT_UNCENSORED` | brak | Ustaw `true` aby odblokować tryb `restrictionLevel: 'none'` |
| `APP_SECRET` | auto | Ręczne nadpisanie wygenerowanego tokenu |
| `UPDATE_CHECK_URL` | GitHub API | URL do sprawdzania aktualizacji |
| `NODE_ENV` | `production` | Ustawiane automatycznie przez Electron |

---

## 10. Chmurowe providery AI

Klucze API przechowywane w `CharbotVault/ai-keys.json` — nigdy w kodzie ani localStorage.

| Provider | Modele (przykłady) |
|----------|--------------------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o3-mini |
| Anthropic | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 |
| Google Gemini | gemini-2.0-flash, gemini-1.5-pro |
| Groq | llama3-70b-8192, mixtral-8x7b |
| Mistral | mistral-large, mistral-small |
| xAI (Grok) | grok-beta |
| Ollama (lokalny) | dowolny model zainstalowany lokalnie |

---

## 11. Typy wiadomości i attachmenty

### Interfejs `Message` (TypeScript)

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;        // ISO 8601
  attachments?: Attachment[];
  toolCalls?: ToolCallEntry[];
}

interface Attachment {
  type: 'image' | 'pdf' | 'csv' | 'text' | 'json';
  name: string;
  url: string;              // /uploads/... (nigdy base64 w DB)
  mimeType: string;
}

interface ToolCallEntry {
  id: string;
  toolName: string;
  args: Record<string, any>;
  result: string;
  status: 'pending' | 'success' | 'error';
}
```

---

## 12. Przykładowe przepływy użycia

### A. Lokalny czat z analizą pliku

1. Użytkownik otwiera sesję, dołącza CSV
2. Frontend uploaduje CSV → `/api/upload` → `Vault/uploads/plik.csv`
3. Wiadomość z referencją do pliku wysyłana do Ollama
4. Model analizuje, odpowiada streamingowo
5. Odpowiedź zapisywana przez `/api/sessions/sync`

### B. Harmonogram — raport poranny

1. Zadanie: `prompt_telegram`, cron `0 8 * * 1-5` (08:00 pon–pt)
2. O 08:00 `scheduler.ts` wywołuje Ollama z skonfigurowanym promptem
3. Odpowiedź wysyłana przez Telegram bot na autoryzowane ID
4. `lastRunAt` i `lastResult` aktualizowane w DB

### C. Webhook plugin — pogoda

1. Użytkownik tworzy webhook tool `pogoda` z URL `https://wttr.in/{city}?format=3`
2. W chacie: "jaka jest pogoda w Krakowie?"
3. Model wykrywa intencję, wywołuje tool `pogoda` z `{city: "Krakow"}`
4. Server wykonuje `GET https://wttr.in/Krakow?format=3` → zwraca wynik do modelu
5. Model formułuje odpowiedź, `ToolCallBubble` pokazuje szczegóły wywołania

### D. Multiroom — debata AI

1. Użytkownik tworzy pokój: tryb `debate`, Pro: "AI jest korzystna", Con: "AI jest niebezpieczna"
2. Drugi użytkownik dołącza z innym modelem przez link + hasło
3. Każda wiadomość ludzka uruchamia sekwencję: model Pro → model Con
4. Wszyscy uczestnicy widzą odpowiedzi w czasie rzeczywistym przez WebSocket

### E. RAG — pamięć długoterminowa

1. Użytkownik klika "Index all sessions" w Knowledge Base
2. Treści sesji chunking → embeddingi Ollama → `rag_embeddings` table
3. Nowe pytanie → embedding pytania → cosine similarity → top-5 chunków
4. Chunki dołączone do system prompt: "Kontekst z poprzednich rozmów: ..."
5. Model odpowiada z uwzględnieniem historycznych informacji

---

## 13. Ograniczenia i znane zachowania

- **Ollama musi być uruchomione** — Charbot OS nie startuje Ollama automatycznie; endpoint domyślnie `http://localhost:11434`
- **Vision** wymaga modelu z listy allowlist (llava, qwen2.5vl, moondream, gemma3, minicpm-v, llava-llama3, llava-phi3, bakllava)
- **RAG embeddingi** — wymagają modelu embedding zainstalowanego w Ollama (np. `nomic-embed-text`)
- **Multiroom** — AI w pokoju używa Ollama; chmurowe modele dla pokoi nie są jeszcze obsługiwane
- **Scheduler** — wysyłka przez Telegram wymaga skonfigurowanego bota i autoryzowanego chat ID
- **Brak synchronizacji chmurowej** — wszystkie dane lokalne; brak funkcji backup do chmury
- **Single-instance lock** — tylko jedna instancja aplikacji może działać jednocześnie (blokada portu 3000)

---

*Dokument wygenerowany automatycznie na podstawie kodu źródłowego Charbot OS v2.2*
