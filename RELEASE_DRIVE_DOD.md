# Charbot Drive — Release Definition of Done

> Dokument obowiązuje od Sprint 0. Każde pole musi być ✅ przed mergem do `main`.

---

## Korekty do audytu (priorytety absolutne)

### P0-5 — Cloud Proxy (GATE, nie można ominąć)

**Problem:** API keys w przeglądarce = iluzja bezpieczeństwa.

**Definition of Done:**
- [ ] Frontend **nie posiada** żadnych kluczy providerów (OpenAI / Gemini / Anthropic) w:
  - `localStorage`
  - `SettingsContext` ani żadnym innym React state/context
  - nagłówkach requestów bezpośrednich do vendor API
- [ ] Wszystkie requesty cloud idą **wyłącznie** przez `/api/ai/chat` (backend proxy)
- [ ] Backend trzyma klucze w `env` lub zaszyfrowanym configu (Vault) + **audyt log** (timestamp, model, token count — bez treści)
- [ ] W trybie **OFFLINE**: każde `/api/ai/*` zwraca `403 Forbidden` (middleware, nie flaga JS)
- [ ] Test: wyłącz backend, uruchom frontend → żadne zapytanie do OpenAI/Gemini/Anthropic nie wychodzi z przeglądarki

> **Reguła:** Jeśli offline/bezpieczeństwo nie jest wymuszone na backendzie, to jest marketing, nie feature.

---

### P0-2 — Jeden sandbox dla FS (brak duplikacji `/api/fs` i `/api/os`)

**Problem:** Dwie ścieżki do systemu plików = dwukrotne ryzyko.

**Definition of Done:**
- [ ] Nie istnieje **żadna** ścieżka w kodzie, która robi `path.resolve(req.body.path)` bez przejścia przez sandbox z `osAgent.ts`
- [ ] `osAgent.ts` to **jedyne** źródło prawdy do walidacji ścieżek (symlink check, prefix check, `allowedDirs`)
- [ ] `/api/fs/*` to cienki wrapper na `osAgent` **albo nie istnieje** (usunięte)
- [ ] Test: `curl -X POST /api/fs/read -d '{"path":"../../etc/passwd"}'` → `403`

---

## Architektura docelowa (po Sprint 2)

### Tryby działania

| Tryb | Co działa | Co jest zablokowane |
|------|-----------|---------------------|
| **Offline** (default) | Ollama + Vault + RAG + Vision lokalnie | Wszelkie cloud API (403 na backendzie) |
| **Cloud** (opt-in) | Backend proxy → vendor API, approval/preview payloadu | Bezpośredni dostęp z frontendu |

### Praca na plikach

- Upload → zapis do `Vault/uploads/{sessionId}/...`
- W DB: **tylko metadata** (nazwa, typ, rozmiar, ścieżka) — **zero base64, zero dataUrl**
- Wyekstrahowany tekst (dla RAG) trzymany osobno jako `.txt` obok pliku
- Mobile: widzi sesje + listę plików + **relatywne linki** do uploads

### Mobile (Vault/mobile/index.html)

- Widok: `last 50` sesji, wyszukiwarka
- Działa offline po USB-C (localhost)
- Linki do plików relatywne (nie bezwzględne, nie base64)

### Remote (Telegram / Discord)

- **Whitelist — pusta = brak dostępu**
- Dozwolone komendy: `/status`, `/last` (max 50), `/search`, `/export`
- Log rotation po 5 MB
- Telegram/Discord — tylko whitelist numerów/ID, zero wyjątków

---

## Dodatkowe P0

### P0-8 — Bind tylko localhost (z wyjątkiem dla Mobile/USB)

```ts
// server.ts
const BIND_HOST = process.env.BIND_HOST ?? '127.0.0.1';
server.listen(3000, BIND_HOST);
```

- [ ] Domyślnie `127.0.0.1` — LAN nie ma dostępu
- [ ] Mobile przez USB-C wymaga `BIND_HOST=0.0.0.0` (lub IP interfejsu USB) + `MOBILE_ONLY_MODE=true`
- [ ] `MOBILE_ONLY_MODE=true` ogranicza dostępne endpointy do read-only (sesje, pliki) — bez `/api/ai/*`, bez exec

> **Uwaga:** `127.0.0.1` i USB-C mobile to wykluczające się opcje — telefon nie widzi loopbacku laptopa.
> Rozwiązanie: osobna flaga, nie kompromis w security.

### P0-10 — Offline mode sterowany z backendu (nie z frontendu)

```bash
# .env
OFFLINE_MODE=true   # backend czyta to — frontend tylko informuje UI
```

```ts
// middleware — sprawdza env, nie body requestu
if (process.env.OFFLINE_MODE === 'true' && req.path.startsWith('/api/ai/')) {
  return res.status(403).json({ error: 'Offline mode — cloud API disabled' });
}
```

- [ ] `OFFLINE_MODE` to zmienna środowiskowa na backendzie
- [ ] Frontend może wyświetlać tryb (odczytany przez `/api/status`), ale **nie może go zmieniać**
- [ ] Test: ustaw `OFFLINE_MODE=true`, wyślij request z frontendu z `offlineMode=false` → dostaje `403`

> **Reguła:** Cokolwiek pochodzi z frontendu, może być sfałszowane. Backend musi mieć własne źródło prawdy.

### P0-11 — Autentykacja lokalna (APP_SECRET)

Nawet `127.0.0.1` nie chroni przed lokalnym malware ani innym procesem na tym samym komputerze.

```ts
// server.ts — generowane przy pierwszym uruchomieniu, zapisane w .env
const APP_SECRET = process.env.APP_SECRET; // np. crypto.randomBytes(32).toString('hex')

// middleware
if (APP_SECRET && req.headers['x-app-secret'] !== APP_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

- [ ] `APP_SECRET` generowany automatycznie przy pierwszym starcie (zapis do `.env`)
- [ ] Frontend czyta go z `/api/init` (jednorazowo przy starcie aplikacji w przeglądarce)
- [ ] Wszystkie requesty frontendowe wysyłają `X-App-Secret` w nagłówku
- [ ] `.env` w `.gitignore` — nigdy nie trafia do repo

### P0-9 — Dangerous endpoints domyślnie off

- [ ] `terminal/exec` — domyślnie `disabled`, włączany przez `ENABLE_EXEC=true` w env
- [ ] `/api/fs/*` (jeśli jeszcze istnieje) — domyślnie `disabled`
- [ ] `/api/ollama/create-model` — tylko gdy `ENABLE_FINE_TUNE=true`
- [ ] Middleware sprawdza flagi przed routingiem (nie w handlerach)

---

## Sprint Plan

### Sprint 0 — Blokery (warunek konieczny do uruchomienia)

| ID | Zadanie | Plik(i) |
|----|---------|---------|
| P0-4 | Telegram whitelist: pusta = deny | `server/telegram.ts` |
| P0-1 | Shell exec: domyślnie off (env flag) | `server.ts`, middleware |
| P0-2 | FS sandbox: jeden `osAgent.ts`, brak duplikacji | `server/osAgent.ts`, `server.ts` |
| P0-8 | Bind `127.0.0.1` + env flag dla mobile | `server.ts` |
| P0-10 | Offline mode z env (`OFFLINE_MODE=true`), nie z frontendu | `server.ts` middleware |
| P0-11 | APP_SECRET — autentykacja lokalna | `server.ts`, `.env` |
| P0-6 | Offline middleware: `/api/ai/*` → 403 | `server.ts` middleware |

**Wynik Sprint 0:** Nawet jeśli ktoś odpali — brak RCE, brak wyjścia poza Vault.

---

### Sprint 1 — Security + Storage Correctness

| ID | Zadanie | Plik(i) |
|----|---------|---------|
| P0-5 | Cloud proxy: klucze tylko na backendzie | `server.ts`, `SettingsContext.tsx`, `useLocalChat.ts` |
| P0-7 | Brak base64 w DB (metadata only) | `server/documents.ts`, schema DB |
| P0-3 | Max 50 sesji/wiadomości wszędzie (UI + API + mobile) | `server.ts`, `SessionPanel.tsx`, `mobile/index.html` |
| P1-4 | Escape HTML w dokumentach (XSS) | `server/documents.ts`, `ArtifactCard.tsx` |
| P0-9 | Dangerous endpoints domyślnie off | `server.ts` |

**Wynik Sprint 1:** Produkt ma sens "secure drive" — DB nie puchnie, XSS zablokowany.

---

### Sprint 2 — UX / Value Delivery

| ID | Zadanie | Plik(i) |
|----|---------|---------|
| P1-2 | Mobile search (last 50) | `Vault/mobile/index.html` |
| P1-3 | Mobile: relatywne linki do uploads | `Vault/mobile/index.html` |
| P1-5 | Log rotation po 5 MB | `server/telegram.ts`, `server/discord.ts` |
| P1-8 | Discord: linki do attachmentów (nie base64) | `server/discord.ts` |
| P1-6 | Vision model allowlist | `server.ts` |

**Wynik Sprint 2:** "Wow demo" + stabilne podstawy gotowe na beta.

---

## Release Checklist (gate przed każdym deployem)

```
[ ] OFFLINE_MODE=true w .env → backend zwraca 403 na /api/ai/* (sprawdzone curl)
[ ] Brak kluczy cloud w przeglądarce (localStorage, context, headers) — sprawdzone DevTools
[ ] /api/terminal/exec domyślnie wyłączone (ENABLE_EXEC nie ustawiony w .env)
[ ] /api/fs nie czyta poza Vault (path sandbox + symlink check)
[ ] getAllSessions i UI pokazują max 50 (mobile też)
[ ] Attachments w DB nie zawierają base64/dataUrl
[ ] mobile/index.html ma search i relatywne linki do uploads
[ ] Telegram: pusta whitelist = brak dostępu (nie wildcard)
[ ] remote.log rotuje po 5 MB
[ ] Serwer binduje na 127.0.0.1 w produkcji (BIND_HOST nie ustawiony)
[ ] APP_SECRET wygenerowany i zapisany w .env (nie w repo)
[ ] Frontend wysyła X-App-Secret w każdym requeście
[ ] .env w .gitignore — zweryfikowane git status
```

---

## Definicja "Final Version" (beta do klienta)

Produkt jest gotowy na beta gdy:

1. Użytkownik może przełączyć tryb Offline ↔ Cloud w UI
2. W trybie Offline: żadne zapytanie nie wychodzi poza `localhost`
3. Pliki lądują w Vault z metadanymi w DB, bez base64
4. Mobile widzi historię offline po USB-C
5. Telegram/Discord odpowiada tylko whiteliście
6. Żaden endpoint nie robi RCE ani path traversal

---

*Wersja: 1.1 — 2026-03-02*
