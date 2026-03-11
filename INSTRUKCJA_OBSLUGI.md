# Charbot OS — Instrukcja Obsługi
### Twoje AI. Twoje dane. Twoje zasady.

---

> **Charbot OS** to lokalne środowisko AI działające w 100% na Twoim komputerze.
> Żaden prompt, żaden plik, żadna rozmowa nie opuszcza Twojego dysku — chyba że Ty tego chcesz.

---

## 01 — Pierwsze uruchomienie

### Instalacja (Windows)

1. Pobierz plik `Charbot OS Setup 2.x.x.exe`
2. Uruchom installer → kliknij **Zainstaluj**
3. Aplikacja uruchomi się automatycznie po instalacji
4. Przy pierwszym starcie pojawi się **Kreator konfiguracji** (3 kroki)

### Kreator konfiguracji

| Krok | Co robisz |
|------|-----------|
| **01 Vault** | Wybierz folder na dane (`~/CharbotVault` domyślnie) |
| **02 Provider** | Wybierz dostawcę AI — Ollama (lokalne) lub klucz API |
| **03 Test** | Wyślij pierwszą wiadomość testową |

### Tryb deweloperski (bez instalatora)

```
cd charbot-os-6
npx tsx server.ts
```
Otwórz `http://127.0.0.1:3000` w przeglądarce.

---

## 02 — Chat — Centrum Dowodzenia

Główny ekran to interfejs rozmowy. Wszystko zaczyna się tutaj.

### Wysyłanie wiadomości

- Wpisz tekst w polu na dole → **Enter** lub przycisk **Wyślij**
- Aby dodać nowy wiersz bez wysyłania: `Shift + Enter`
- Kliknij **✕** obok paska ładowania, aby przerwać generowanie

### Załączniki

Kliknij ikonę **📎** lub przeciągnij plik na okno czatu.

| Typ pliku | Co Charbot z nim zrobi |
|-----------|------------------------|
| JPG / PNG / WEBP | Analiza obrazu (OCR, opis, dane) |
| PDF | Odczyt treści, streszczenie |
| TXT / MD / CSV / JSON | Analiza, edycja, pytania o dane |
| XLSX | Odczyt arkusza jako tekst |

> **Limit:** 50 MB na plik. HEIC/HEIF nie jest obsługiwany — skonwertuj do JPG.

### Kopiowanie tekstu z chatu

**Sposób 1 — przycisk Copy:**
Najedź kursorem na dowolny bąbelek wiadomości → pojawi się przycisk `Copy` w prawym górnym rogu.
Kliknij → tekst trafia do schowka. Zmiana na `✓ OK` potwierdza skopiowanie.

**Sposób 2 — zaznaczenie:**
Zaznacz fragment tekstu myszą → kliknij prawym przyciskiem → **Kopiuj**.
Menu skopiuje tylko zaznaczony fragment.

**Sposób 3 — menu kontekstowe (prawy przycisk):**
Kliknij prawym przyciskiem na wiadomość. Dostępne opcje:

| Opcja | Działanie |
|-------|-----------|
| **Kopiuj** | Kopiuje zaznaczony tekst lub całą wiadomość |
| **Kopiuj jako tekst** | Kopiuje surowy Markdown (bez formatowania) |
| **Odpowiedz** | Wkleja cytat wiadomości do pola input |
| **Usuń wiadomość** | Usuwa wiadomość z sesji |

### Pasek narzędzi (prawy górny róg chatu)

| Ikona | Funkcja |
|-------|---------|
| `Brain` | Knowledge Base — baza wiedzy RAG |
| `FolderOpen` | Dokumenty — zapisane artefakty |
| `FileOutput` | Eksport sesji (PDF, MD, TXT) |
| `Telegram` | Wyślij sesję do Telegrama |
| `Settings` | Ustawienia systemowe |
| `Trash` | Wyczyść bieżący chat |

---

## 03 — Sesje

Każda rozmowa to osobna **sesja** — widoczna w panelu po lewej.

### Zarządzanie sesjami

- **Nowa sesja:** kliknij `+` w panelu po lewej
- **Zmiana nazwy:** kliknij dwukrotnie na tytuł sesji
- **Usunięcie:** ikona kosza przy sesji
- **Limit:** 50 ostatnich sesji (starsze są automatycznie usuwane)

### Eksport sesji

Kliknij ikonę `FileOutput` → wybierz format:

| Format | Zawartość |
|--------|-----------|
| **Markdown** | Pełna rozmowa z formatowaniem |
| **PDF** | Gotowy do druku / wysyłki |
| **TXT** | Surowy tekst |
| **JSON** | Dane maszynowe |

---

## 04 — Dostawcy AI

Przejdź do **Settings → Provider** aby skonfigurować model.

### Ollama (lokalne, zalecane)

Ollama uruchamia modele AI w 100% na Twoim komputerze — zero chmury.

```
# Instalacja modelu:
ollama pull llama3.2
ollama pull nomic-embed-text   # wymagany do RAG
```

Ustaw endpoint: `http://localhost:11434`

### Dostawcy chmurowi

| Provider | Gdzie wpisać klucz | Przykładowy model |
|----------|-------------------|-------------------|
| OpenAI | Settings → Provider → OpenAI | `gpt-4o` |
| Google Gemini | Settings → Provider → Google | `gemini-2.5-flash-latest` |
| Anthropic | Settings → Provider → Anthropic | `claude-sonnet-4-6` |

> Klucze API są przechowywane wyłącznie w `CharbotVault/ai-keys.json` — nigdy w przeglądarce.

---

## 05 — Parametry modelu

**Settings → Parameters**

| Parametr | Opis | Typowy zakres |
|----------|------|---------------|
| **Temperature** | Kreatywność odpowiedzi — wyżej = bardziej losowo | 0.0 – 1.5 |
| **Top P** | Ograniczenie puli tokenów | 0.0 – 1.0 |
| **Max Tokens** | Maksymalna długość odpowiedzi | 512 – 8192 |

---

## 06 — System Prompt

**Settings → System Prompt**

Wpisz stałą instrukcję, którą Charbot otrzymuje przed każdą rozmową.

Przykłady:
- `Odpowiadaj zawsze po polsku. Bądź zwięzły.`
- `Jesteś asystentem prawnym. Cytuj przepisy.`
- `Mów do mnie per "szefie". Używaj punktorów.`

---

## 07 — Persona

**Settings → Persona**

Zmień tożsamość i styl asystenta.

| Pole | Opis |
|------|------|
| **Nazwa** | Jak ma się przedstawiać (np. "ARIA") |
| **Poziom ograniczeń** | Standard / Minimal / Brak cenzury* |
| **Zachowanie** | Dowolny opis stylu, np. "mów zwięźle, nie pytaj o zgodę" |

> *Tryb `Brak cenzury` wymaga zmiennej środowiskowej `CHARBOT_UNCENSORED=true`.

---

## 08 — OS File Agent

**Settings → OS Agent**

Pozwala modelowi AI **czytać i zapisywać pliki** na Twoim dysku.
Wskaż dozwolone katalogi — agent nie wyjdzie poza nie.

### Dostępne narzędzia agenta

| Narzędzie | Co robi |
|-----------|---------|
| `list_dir` | Listuje zawartość katalogu |
| `search_files` | Szuka plików po nazwie (max głębokość 4) |
| `read_file` | Czyta plik tekstowy lub arkusz XLSX |
| `write_file` | Tworzy lub nadpisuje plik |
| `append_csv` | Dopisuje wiersz do pliku CSV |

### Jak używać

Napisz normalnie:
```
Sprawdź co mam w ~/Downloads i posortuj pliki według rozmiaru.
Zapisz wynik do ~/Desktop/raport.txt
```

Agent wywoła narzędzia automatycznie — wyniki widoczne są jako bąbelki `TOOL CALL`.

---

## 09 — Plugins (Wtyczki)

**Settings → Plugins**

Rozszerz agenta o własne narzędzia — bez przebudowy aplikacji.

### Typ A — Plik .mjs

Umieść plik `*.mjs` w katalogu `CharbotVault/plugins/`:

```javascript
// CharbotVault/plugins/kurs_btc.mjs
export const name = 'kurs_btc';
export const description = 'Pobiera aktualny kurs BTC w PLN.';
export const parameters = {};

export async function execute(_args, _ctx) {
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=pln');
  const d = await r.json();
  return `BTC: ${d.bitcoin.pln} PLN`;
}
```

Kliknij **Reload** w Settings → Plugins → wtyczka pojawia się na liście z niebieskim badge `FILE`.

### Typ B — Webhook Tool (bez kodowania)

W Settings → Plugins → sekcja "Webhook Tools":

1. Podaj nazwę (np. `pogoda`)
2. URL template: `https://wttr.in/{miasto}?format=3`
3. Metoda: `GET`
4. Parametry: `miasto` → "nazwa miasta"
5. Kliknij **Zapisz webhook**

Model może teraz wywołać `pogoda` z parametrem `miasto` — wynik wraca do chatu.

> Wtyczki działają w pętli agenta — możesz łączyć je z narzędziami OS.

---

## 10 — Scheduler (Harmonogram)

**Settings → Scheduler**

Automatyzuj zadania AI bez Twojej obecności.

### Dodawanie zadania

1. Kliknij **Dodaj zadanie**
2. Wypełnij formularz:

| Pole | Opis |
|------|------|
| **Nazwa** | Dowolna etykieta |
| **Typ** | Patrz tabela poniżej |
| **Godzina** | Format HH:MM |
| **Dni tygodnia** | Pon–Nd, dowolna kombinacja |

### Typy zadań

| Typ | Co robi |
|-----|---------|
| **Prompt → Telegram** | Wysyła prompt do Ollamy → odpowiedź trafia na Twój Telegram |
| **Export sesji** | Eksportuje wybraną sesję i wysyła link na Telegram |
| **OS Agent** | Wykonuje polecenie agenta (np. backup plików) → wynik na Telegram |

### Zarządzanie zadaniami

| Akcja | Jak |
|-------|-----|
| **Włącz / Wyłącz** | Kliknij przełącznik przy zadaniu |
| **Uruchom teraz** | Przycisk ▶ — natychmiastowe wykonanie |
| **Podgląd wyniku** | Kliknij ▼ przy zadaniu → `lastResult` + data ostatniego uruchomienia |
| **Usuń** | Ikona kosza |

> Zadania działają w tle — Charbot nie musi być aktywny na ekranie, wystarczy że serwer działa.

---

## 11 — Knowledge Base (RAG)

**Ikona Brain w chacie → Knowledge Base**

Baza wiedzy pozwala modelowi "pamiętać" treść starych sesji i plików.

### Jak działa

```
01. Indeksujesz treść (sesje, pliki)
    ↓
02. Charbot zamienia tekst na wektory (embeddingi)
    ↓  wymaga: ollama pull nomic-embed-text
03. Przy każdym pytaniu — automatyczne wyszukanie podobnych fragmentów
    ↓
04. Model dostaje kontekst z przeszłości → odpowiedź jest precyzyjniejsza
```

### Włączenie RAG

Settings → Vision/RAG → włącz **RAG** → wybierz model embeddingów (domyślnie `nomic-embed-text`).

### Panel Knowledge Base

| Akcja | Efekt |
|-------|-------|
| **Indeksuj wszystkie sesje** | Tworzy embeddingi dla wszystkich rozmów z historii |
| **Wyczyść indeks** | Usuwa wszystkie embeddingi (wymaga potwierdzenia) |
| Kliknij 🗑 przy sesji | Usuwa embeddingi tylko tej sesji |

### Statystyki

| Metryka | Opis |
|---------|------|
| **Chunks** | Liczba zaindeksowanych fragmentów tekstu |
| **Sesje** | Liczba sesji z embeddingami |
| **Model** | Aktywny model embeddingów |

---

## 12 — Dokumenty (Artefakty)

Gdy model wygeneruje plik (np. raport, kod, tabelę) — pojawia się jako **ArtifactCard** w czacie.

### Obsługiwane formaty artefaktów

`TXT` · `MD` · `HTML` · `JSON` · `CSV` · `PDF`

### Zapisywanie

Kliknij **Zapisz** na karcie artefaktu → plik ląduje w `CharbotVault/documents/`.

### Panel Dokumentów

Kliknij ikonę `FolderOpen` w chacie → lista zapisanych plików → pobierz lub usuń.

---

## 13 — Vision (Analiza obrazów)

Wymagany model z obsługą wizji: `llava`, `qwen2.5vl`, `moondream` lub analogiczny OpenAI/Gemini.

### Presety analizy

Po załączeniu obrazu kliknij **analizuj**:

| Preset | Prompt |
|--------|--------|
| **Odczyt tekstu (OCR)** | Transkrybuje wszystkie widoczne teksty |
| **Opis obrazu** | 3–5 zdań opisu sceny, kolorów, szczegółów |
| **Dane tabelaryczne** | Wyciąga dane do Markdown |
| **Diagnoza kodu** | Analizuje screenshoty kodu |

---

## 14 — Telegram Bot

**Settings → Telegram**

Czatuj z Charbotem przez Telegram — z dowolnego miejsca na świecie.

### Konfiguracja

1. Utwórz bota przez [@BotFather](https://t.me/BotFather) → skopiuj token
2. Wklej token w Settings → Telegram
3. Napisz `/register` do swojego bota → nadajesz sobie dostęp

### Komendy bota

| Komenda | Działanie |
|---------|-----------|
| `/chat <wiadomość>` | Jednorazowa odpowiedź AI |
| `/ask <wiadomość>` | Konwersacja z historią |
| `/reset` | Wyczyść historię bota |
| `/status` | Status systemu |
| `/last` | Ostatnie 5 sesji |
| `/search <fraza>` | Szukaj w sesjach |
| `/export <id\|last>` | Pobierz transkrypt sesji |
| `/photo last` | Ostatnie przesłane zdjęcie |

> Tylko zarejestrowani użytkownicy mogą korzystać z bota (whitelist).

---

## 15 — Discord Bot

**Settings → Discord** (wymaga zmiennej `DISCORD_BOT_TOKEN`)

Analogicznie do Telegrama — bot odpowiada na komendy z prefiksem `!cb`.

| Komenda | Działanie |
|---------|-----------|
| `!cb <pytanie>` | Zapytaj AI |
| `!cb export last` | Eksportuj ostatnią sesję |

---

## 16 — Mobile Portal

Dostęp do sesji z telefonu przez lokalną sieć Wi-Fi lub kabel USB-C.

1. Kliknij **Export to Phone** przy sesji
2. Charbot generuje stronę HTML w `CharbotVault/mobile/`
3. Otwórz `http://127.0.0.1:3000/mobile` na telefonie (ta sama sieć)

---

## 17 — Bezpieczeństwo

Charbot OS został zaprojektowany z myślą o prywatności od podstaw.

| Mechanizm | Działanie |
|-----------|-----------|
| **Lokalny bind** | Serwer nasłuchuje wyłącznie na `127.0.0.1` — niedostępny z zewnątrz |
| **APP_SECRET** | Każde żądanie API wymaga tokenu generowanego przy starcie |
| **Vault sandbox** | OS Agent działa tylko w dozwolonych katalogach |
| **Klucze API w Vault** | Nigdy w przeglądarce, nigdy w localStorage |
| **Offline mode** | `CHARBOT_OFFLINE=true` blokuje wszystkie dostawcy chmurowi |
| **Rate limiting** | 60 req/min na `/api`, 40 req/min na AI |
| **Log rotation** | Logi rotowane po 5 MB |

---

## 18 — Zmienne środowiskowe

Utwórz plik `.env` w katalogu aplikacji:

```env
# Lokalizacja Vault (domyślnie ~/CharbotVault)
CHARBOT_VAULT_DIR=D:/MójVault

# Blokada chmury
CHARBOT_OFFLINE=true

# Zezwól na wykonywanie poleceń shell
ENABLE_EXEC=true

# Zezwól na fine-tuning modeli
ENABLE_FINE_TUNE=true

# Tryb uncensored
CHARBOT_UNCENSORED=true

# Bind na interfejsie sieciowym (domyślnie 127.0.0.1)
BIND_HOST=0.0.0.0

# Własny token autoryzacji
APP_SECRET=mój_tajny_token
```

---

## 19 — Struktura Vault

Wszystkie dane aplikacji trafiają do jednego folderu:

```
CharbotVault/
├── charbot.db           ← baza SQLite (sesje, scheduler, RAG)
├── ai-keys.json         ← klucze API (zaszyfrowane)
├── app-secret.txt       ← token autoryzacji
├── telegram-config.json ← konfiguracja bota
├── uploads/             ← przesłane pliki (per sesja)
├── documents/           ← zapisane artefakty
├── plugins/             ← wtyczki .mjs
├── plugins-webhook.json ← webhook tools
├── mobile/              ← portal mobilny (HTML)
└── logs/                ← logi serwera (rotowane co 5 MB)
```

---

## 20 — Rozwiązywanie problemów

### Model nie odpowiada

```
✓ Sprawdź czy Ollama działa: ollama list
✓ Zweryfikuj endpoint w Settings → Provider (http://localhost:11434)
✓ Sprawdź czy model jest pobrany: ollama pull llama3.2
```

### RAG nie działa

```
✓ Włącz RAG w Settings → Vision/RAG
✓ Pobierz model embeddingów: ollama pull nomic-embed-text
✓ Zaindeksuj sesje: Knowledge Base → Indeksuj wszystkie sesje
```

### Wtyczka nie pojawia się

```
✓ Plik musi mieć rozszerzenie .mjs (nie .js)
✓ Musi eksportować: name, description, parameters, execute
✓ Kliknij "Reload" w Settings → Plugins
```

### Scheduler nie wykonuje zadań

```
✓ Sprawdź czy zadanie jest włączone (zielony przełącznik)
✓ Użyj "Run now" ▶ aby przetestować natychmiast
✓ Dla Prompt → Telegram: skonfiguruj bota Telegram (punkt 14)
✓ Sprawdź logi: CharbotVault/logs/scheduler.log
```

### Port 3000 zajęty

```powershell
# Windows — znajdź i zabij proces:
netstat -ano | findstr :3000
Stop-Process -Id <PID> -Force
```

---

## Wersje

| Wersja | Co nowego |
|--------|-----------|
| **2.1** | Scheduler · Plugins · Knowledge Base UI · Custom cursor · Chat context menu |
| **2.0** | Electron installer · Beta UX · Hardening |
| **1.x** | Cloud proxy · OS Agent · Telegram · Discord · Mobile portal · RAG |

---

*Charbot OS — lokalne AI bez kompromisów.*
*[charbot.org](https://www.charbot.org)*
