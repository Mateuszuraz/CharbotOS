# Raport audytu bezpieczeństwa — Charbot OS v2.0.0

**Data:** 2026-03-06
**Zakres:** `server.ts`, WebSocket, upload pipeline, session sync
**Znaleziono:** 4 luki (1 CRITICAL, 2 MEDIUM, 1 LOW)
**Status:** WSZYSTKIE NAPRAWIONE

---

## CRITICAL — A1: Path traversal w `/api/rag/index-file`

**Lokalizacja:** `server.ts` ~linia 1037–1043
**CVSS v3:** 9.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)

**Podatny kod:**
```typescript
app.post('/api/rag/index-file', async (req, res) => {
  const { filePath } = req.body;
  const raw = await fs.readFile(filePath, 'utf-8'); // ← brak walidacji
```

**Eksploitacja:** Attacker wysyła `POST /api/rag/index-file` z `filePath: "C:/Windows/System32/drivers/etc/hosts"` lub dowolnym plikiem systemu. Odpowiedź serwera zwraca pełną treść pliku.

**Naprawa:**
```typescript
const safePath = path.resolve(filePath);
const allowedBase = path.resolve(path.join(getVaultDir(), 'uploads'));
const rel = path.relative(allowedBase, safePath);
if (rel.startsWith('..') || path.isAbsolute(rel)) {
  res.status(403).json({ error: 'Access denied: only Vault/uploads files allowed' });
  return;
}
```

**Weryfikacja:** `POST /api/rag/index-file` z `filePath: "C:/Windows/..."` → HTTP 403

---

## MEDIUM — A3: Memory leak WebSocket (dead connections)

**Lokalizacja:** `server.ts` → `_handleRoomWS()`
**CVSS v3:** 5.9 (AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H)

**Problem:** Klient, który utracił połączenie TCP bez prawidłowego zamknięcia (utrata zasilania, awaria sieci), nigdy nie wywoła zdarzenia `close`. Serwer przechowuje obiekt `ws` w pamięci na zawsze. Przy wystarczającej liczbie takich klientów — OOM.

**Naprawa:** Server-side ping/pong heartbeat co 30s z terminacją przy braku odpowiedzi:
```typescript
let isAlive = true;
ws.on('pong', () => { isAlive = true; });
const heartbeat = setInterval(() => {
  if (!isAlive) { clearInterval(heartbeat); ws.terminate(); return; }
  isAlive = false;
  ws.ping();
}, 30_000);
// clearInterval w ws.on('close') i ws.on('error')
```

**Weryfikacja:** Klient bez aktywności przez ~60s → serwer terminuje socket

---

## MEDIUM — A4: Brak limitu wiadomości w sesji (`/api/sessions/sync`)

**Lokalizacja:** `server.ts` ~linia 645
**CVSS v3:** 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L)

**Problem:** Endpoint przyjmuje i zapisuje sesję z dowolną liczbą wiadomości. Sesja z 50 000+ wiadomościami powoduje:
- Blokujący `JSON.parse()` w przeglądarce (UI freeze)
- Wzrost rozmiaru `sessions.db` bez ograniczeń
- Potencjalny OOM przy deserializacji

**Naprawa:**
```typescript
const limitedMessages = (s.messages || []).slice(-500);
```

**Weryfikacja:** Sync sesji z >500 wiadomościami → DB zawiera max 500 (ostatnie)

---

## LOW — A2: Path traversal w multer `sessionId`

**Lokalizacja:** `server.ts` → `multer.diskStorage` ~linia 196
**CVSS v3:** 4.3 (AV:N/AC:H/PR:L/UI:N/S:U/C:L/I:L/A:N)

**Podatny kod:**
```typescript
const sessionId = (req.query.sessionId as string) || 'misc';
const uploadDir = path.join(getVaultDir(), 'uploads', sessionId);
// sessionId = "../../Windows" → upload poza Vault
```

**Naprawa:**
```typescript
const sessionId = ((req.query.sessionId as string) || 'misc').replace(/[^a-zA-Z0-9_-]/g, '');
```

**Weryfikacja:** Upload z `?sessionId=../../Windows` → zapis w `misc/` lub katalogu odpowiadającym oczyszczonemu ID

---

## Ogólna ocena stanu bezpieczeństwa

| Kategoria | Stan przed | Stan po |
|-----------|-----------|---------|
| Path traversal | 2 aktywne luki | Naprawione |
| Memory management (WS) | Brak heartbeat | Heartbeat 30s + terminate |
| DoS ochrona (msg limit) | Brak | Max 500 msg/sesja |
| Klucze API w przeglądarce (P0-5) | Naprawione wcześniej | OK |
| Shell exec (P0-1) | Naprawione wcześniej | OK |
| XSS (P1-4) | Naprawione wcześniej | OK |
| Bind 127.0.0.1 (P0-8) | Naprawione wcześniej | OK |

**Łączny wynik po naprawach:** Brak znanych luk w zakresie audytu.
