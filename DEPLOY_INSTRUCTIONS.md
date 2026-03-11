# Charbot OS — Instrukcja wdrożenia

## Wymagania

| Wymaganie | Wersja |
|-----------|--------|
| Windows 10/11 (64-bit) | zalecane Win 11 |
| Ollama | najnowsza (`ollama.com`) |
| RAM | min. 8 GB (16 GB zalecane) |
| SSD | min. 2 GB wolnego miejsca |
| Node.js | tylko do dev — nie jest wymagany dla użytkownika końcowego |

---

## Instalacja (tryb Electron — instalator .exe)

### Krok 1 — Pobierz i uruchom instalator

Plik: `Charbot OS Setup 2.0.0.exe`

> **Windows Defender / SmartScreen — ważna informacja**
>
> Ponieważ instalator nie posiada certyfikatu podpisu kodu (Code Signing Certificate),
> Windows SmartScreen wyświetli komunikat **„Nieznany wydawca"** lub **„Chroniłem Twój komputer"**.
>
> Aby zainstalować aplikację:
> 1. Kliknij **„Więcej informacji"** (More info)
> 2. Kliknij **„Uruchom mimo to"** (Run anyway)
>
> Jest to zachowanie normalne dla aplikacji bez komercyjnego certyfikatu. Kod źródłowy jest dostępny do weryfikacji.

### Krok 2 — Wybierz katalog instalacji

Zalecane: `C:\Users\<Twoja Nazwa>\AppData\Local\Programs\Charbot OS\`

Lub dowolny folder na SSD — np. `D:\CharBotOS\`.

### Krok 3 — Zakończ instalację

Kliknij „Zainstaluj" i poczekaj ok. 30–60 sekund.
Na pulpicie i w menu Start pojawi się skrót **Charbot OS**.

---

## Uruchamianie

1. Otwórz **Ollama** (upewnij się, że działa w tle — ikona w zasobniku systemowym)
2. Uruchom **Charbot OS** ze skrótu

Aplikacja automatycznie:
- uruchamia wbudowany serwer na porcie `3000`
- otwiera okno przeglądarki/Electron z interfejsem czatu

---

## Konfiguracja pierwszego uruchomienia

### Vault (magazyn danych)

Charbot OS tworzy folder **Vault** w:
```
C:\Users\<Twoja Nazwa>\AppData\Roaming\Charbot OS\Vault\
```
Vault zawiera:
- `sessions.db` — historia czatów (SQLite)
- `ai-keys.json` — klucze API (szyfrowane lokalnie)
- `uploads/` — przesłane pliki
- `logs/` — logi działania

### Dodanie modelu Ollama

```bash
# W terminalu — przykłady
ollama pull llama3.2
ollama pull qwen2.5vl       # do widzenia (vision)
ollama pull nomic-embed-text # do RAG
```

### Konfiguracja w aplikacji

1. Kliknij ikonę ustawień (⚙️) w prawym górnym rogu
2. W zakładce **Model**: wybierz provider `Ollama` i kliknij odśwież — pojawi się lista pobranych modeli
3. W zakładce **Vision**: wybierz model do analizy obrazów (np. `qwen2.5vl`)
4. W zakładce **Agent**: włącz OS Agent jeśli chcesz, aby AI mogło operować na plikach

---

## Instalacja na zewnętrznym SSD

Jeśli chcesz uruchamiać Charbot OS z przenośnego SSD:

1. **Skopiuj folder instalacji** (np. `D:\CharBotOS\`) na SSD
2. **Zmienne środowiskowe** (opcjonalne) — utwórz plik `start.bat` na SSD:

```bat
@echo off
set CHARBOT_VAULT=D:\CharBotOS\Vault
set BIND_HOST=127.0.0.1
"D:\CharBotOS\Charbot OS.exe"
```

3. Uruchamiaj z `start.bat` zamiast ze skrótu — Vault będzie na SSD

---

## Zmienne środowiskowe

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `CHARBOT_VAULT` | `%APPDATA%/Charbot OS/Vault` | Ścieżka do Vault |
| `BIND_HOST` | `127.0.0.1` | Adres bind serwera (nie zmieniaj na `0.0.0.0` bez zapory) |
| `PORT` | `3000` | Port serwera |
| `ENABLE_EXEC` | `false` | Włącz wykonywanie poleceń shell (`true` tylko jeśli wiesz co robisz) |
| `CHARBOT_OFFLINE` | `false` | Wyłącz wszystkie żądania do zewnętrznych API |
| `APP_SECRET` | auto | Token bezpieczeństwa (generowany przy pierwszym uruchomieniu) |
| `ENABLE_FINE_TUNE` | `false` | Włącz zakładkę fine-tuningu modeli Ollama |

---

## Aktualizacja

1. Pobierz nowy instalator `Charbot OS Setup X.X.X.exe`
2. Uruchom — instalator nadpisze poprzednią wersję
3. Vault (historia, klucze, pliki) **nie jest usuwany** podczas aktualizacji

---

## Odinstalowanie

Użyj **Dodaj lub usuń programy** w Windows → wyszukaj **Charbot OS** → Odinstaluj.

> Vault NIE jest usuwany automatycznie. Aby usunąć dane, ręcznie skasuj:
> `C:\Users\<Twoja Nazwa>\AppData\Roaming\Charbot OS\`

---

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
|---------|-------------|
| Aplikacja nie startuje / biały ekran | Sprawdź czy port 3000 nie jest zajęty: `netstat -an \| findstr :3000` |
| Brak modeli w dropdownie | Upewnij się, że Ollama działa: `ollama list` w terminalu |
| Vision nie działa | Pobierz model vision: `ollama pull qwen2.5vl` |
| RAG nie indeksuje | Pobierz model embeddings: `ollama pull nomic-embed-text` |
| SmartScreen blokuje | Kliknij „Więcej informacji" → „Uruchom mimo to" |
| Błąd 401 w API | Odśwież stronę — token APP_SECRET był nieaktualny |

---

## Bezpieczeństwo

- Serwer nasłuchuje **tylko na 127.0.0.1** (localhost) — nie jest dostępny z sieci
- Klucze API są przechowywane **wyłącznie w Vault** na dysku lokalnym — nigdy w localStorage przeglądarki
- Historia czatów jest w lokalnej bazie SQLite — nie są wysyłane do chmury (chyba że wybierzesz provider cloud)
- Shell exec jest **domyślnie wyłączony** — włącz `ENABLE_EXEC=true` tylko świadomie

---

*Charbot OS v2.0.0 | Build: Sprint 5 Complete*
