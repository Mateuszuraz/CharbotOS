/** Tutorial content for all advanced features — EN + PL */

export interface TutorialEntry {
  title: string;
  description: string;
  tip?: string;
}

type TutorialKey =
  | 'nav_chat' | 'nav_sessions' | 'nav_flows' | 'nav_gallery'
  | 'nav_settings' | 'nav_theme' | 'nav_templates' | 'nav_tutorial'
  | 'chat_attach' | 'chat_camera' | 'chat_vision' | 'chat_telegram'
  | 'chat_documents' | 'chat_export' | 'chat_clear'
  | 'settings_provider' | 'settings_params' | 'settings_prompt'
  | 'settings_vision' | 'settings_persona' | 'settings_agent'
  | 'settings_telegram' | 'settings_language'
  | 'persona_restriction' | 'persona_name' | 'persona_behavior'
  | 'agent_dirs' | 'agent_toggle'
  | 'rag_toggle' | 'finetune' | 'export_panel';

const en: Record<TutorialKey, TutorialEntry> = {
  // Sidebar nav
  nav_chat: {
    title: 'Chat',
    description: 'Main AI conversation interface. Start a session, attach files, take photos, and chat with any AI model.',
    tip: 'Drag & drop files directly into the chat window.',
  },
  nav_sessions: {
    title: 'Sessions',
    description: 'Browse and switch between past conversations. All sessions are auto-saved to your Vault.',
    tip: 'Click any session to load it. Sessions persist across restarts.',
  },
  nav_flows: {
    title: 'Automation Flows',
    description: 'Build visual AI pipelines using a node editor. Connect Prompt → AI → Shell → Output nodes to automate tasks.',
    tip: 'Right-click the canvas to add nodes. Use Shell nodes to run scripts.',
  },
  nav_gallery: {
    title: 'Photo Gallery',
    description: 'View all photos captured via the webcam or camera. Photos are archived to your Vault automatically.',
    tip: 'Click a photo to send it to chat for AI analysis.',
  },
  nav_settings: {
    title: 'Settings',
    description: 'Configure AI provider, model, persona, OS agent, RAG memory, Telegram bot, and more.',
    tip: 'Use Ollama for 100% offline, local AI. Install from ollama.com.',
  },
  nav_theme: {
    title: 'Theme',
    description: 'Switch between Light, Dark, and System themes. The app adapts to your OS preference automatically.',
    tip: 'System theme follows your OS dark/light mode setting.',
  },
  nav_templates: {
    title: 'Prompt Templates',
    description: 'Pre-built prompt templates for common tasks: code review, analysis, email drafting, etc.',
    tip: 'Click a template to load it into the chat input instantly.',
  },
  nav_tutorial: {
    title: 'Tutorial Mode',
    description: 'When ON, hover over any UI element to see a brief explanation of its function.',
    tip: 'Toggle this off once you are familiar with the app.',
  },

  // Chat header buttons
  chat_attach: {
    title: 'Attach Files',
    description: 'Attach images, PDFs, or text files to your message. AI will read and analyze the content.',
    tip: 'Supported: JPG, PNG, WebP, PDF, TXT, MD, JSON, CSV, HTML, code files.',
  },
  chat_camera: {
    title: 'Webcam Capture',
    description: 'Capture a photo from your webcam or any connected camera (GoPro, phone, etc.) for AI analysis.',
    tip: 'After capture, click the scan icon on the photo to run local vision AI.',
  },
  chat_vision: {
    title: 'Vision Analysis',
    description: 'Analyze the attached image using a local Ollama vision model (qwen2.5vl, llava, etc.).',
    tip: 'Choose: OCR (read text), Describe, or Extract JSON fields.',
  },
  chat_telegram: {
    title: 'Send to Telegram',
    description: 'Send this entire session transcript to your connected Telegram bot as a document.',
    tip: 'Configure the bot in Settings → Telegram tab first.',
  },
  chat_documents: {
    title: 'Vault / Documents',
    description: 'Open the document vault. View, download, or delete AI-generated files (PDF, MD, HTML, etc.).',
    tip: 'Ask AI to create a document: "Save this as notes.md"',
  },
  chat_export: {
    title: 'Export Session',
    description: 'Export the current chat session as a professional PDF, Markdown file, or share via email.',
    tip: 'PDF is generated server-side with clean formatting.',
  },
  chat_clear: {
    title: 'Clear Chat',
    description: 'Clears the current session messages from view. The session history is preserved in Sessions panel.',
    tip: 'This only clears the display — use the Sessions panel to delete permanently.',
  },

  // Settings tabs
  settings_provider: {
    title: 'AI Provider',
    description: 'Choose your AI backend: Ollama (local, offline), OpenAI (GPT-4), Google Gemini, or Anthropic (Claude).',
    tip: 'Ollama requires the Ollama app running locally on port 11434.',
  },
  settings_params: {
    title: 'Model Parameters',
    description: 'Fine-tune how the AI generates responses: Temperature (creativity), Top-P (diversity), Max Tokens (length).',
    tip: 'Higher temperature = more creative but less predictable answers.',
  },
  settings_prompt: {
    title: 'System Prompt',
    description: 'The system prompt defines AI behavior for every conversation. Customize its personality, role, and constraints.',
    tip: 'Changes take effect on the next message you send.',
  },
  settings_vision: {
    title: 'Vision & RAG',
    description: 'Configure local image analysis (Vision) and cross-session semantic memory search (RAG).',
    tip: 'RAG requires Ollama + nomic-embed-text model: ollama pull nomic-embed-text',
  },
  settings_persona: {
    title: 'Persona Mode',
    description: 'Give the AI a custom name and control its response style. Minimal/None removes AI disclaimers.',
    tip: 'For Restriction: None, use an uncensored Ollama model like dolphin-mistral.',
  },
  settings_agent: {
    title: 'OS File Agent',
    description: 'Grant the AI access to read, search, write, and append files on your local filesystem.',
    tip: 'Ask: "Find all PDF files in ~/Downloads" or "Add row to ~/Desktop/log.csv"',
  },
  settings_telegram: {
    title: 'Telegram Bot',
    description: 'Connect a Telegram bot to chat with AI from your phone. Supports /chat, /ask, /search commands.',
    tip: 'Create a bot via @BotFather on Telegram to get a token.',
  },
  settings_language: {
    title: 'Language',
    description: 'Switch the app UI between English and Polish. The AI responds in the language you write in.',
    tip: 'AI auto-detects language — write in Polish, get Polish responses.',
  },

  // Persona details
  persona_restriction: {
    title: 'Restriction Level',
    description: 'Standard: normal AI behavior. Minimal: removes "As an AI…" disclaimers. None: fully uncensored responses.',
    tip: 'Use None only with uncensored local models (dolphin, wizard-vicuna).',
  },
  persona_name: {
    title: 'Persona Name',
    description: 'Give the AI a custom name. It will introduce itself and be addressed by this name throughout conversations.',
    tip: 'Leave blank to keep the default "Charbot" identity.',
  },
  persona_behavior: {
    title: 'Custom Behavior',
    description: 'Additional behavioral instructions appended to every system prompt. Define tone, format, or rules.',
    tip: 'Example: "Always respond in bullet points. Use formal language."',
  },

  // Agent details
  agent_dirs: {
    title: 'Allowed Directories',
    description: 'The AI can only access files within these directories. Add or remove paths to control access scope.',
    tip: 'Use ~/Downloads, ~/Desktop, ~/Documents for safe access. Avoid system directories.',
  },
  agent_toggle: {
    title: 'OS File Agent',
    description: 'When enabled, the AI can list, read, write, and append files using XML tool calls in its responses.',
    tip: 'Watch for <tool_call> bubbles in the chat — they show what the AI is doing.',
  },

  // RAG
  rag_toggle: {
    title: 'RAG Memory',
    description: 'Semantic search across all past sessions. AI automatically finds and injects relevant past conversations.',
    tip: 'Requires Ollama + nomic-embed-text. Index builds as you chat.',
  },

  // Fine-tune
  finetune: {
    title: 'Create Custom Model',
    description: 'Build a new Ollama model with a baked-in system prompt using Modelfile. No training data needed.',
    tip: 'Example: base=llama3, name=my-lawyer, system prompt = "You are a legal expert…"',
  },

  // Export panel
  export_panel: {
    title: 'Professional Export',
    description: 'Export session as formatted PDF (server-generated), Markdown file (download), or share via email.',
    tip: 'PDF is saved to ~/CharbotVault/documents/ and auto-opened for download.',
  },
};

const pl: Record<TutorialKey, TutorialEntry> = {
  nav_chat: {
    title: 'Czat',
    description: 'Główny interfejs rozmowy z AI. Rozpocznij sesję, dołącz pliki, zrób zdjęcie i rozmawiaj z dowolnym modelem.',
    tip: 'Przeciągnij i upuść pliki bezpośrednio do okna czatu.',
  },
  nav_sessions: {
    title: 'Sesje',
    description: 'Przeglądaj i przełączaj między poprzednimi rozmowami. Wszystkie sesje są automatycznie zapisywane.',
    tip: 'Kliknij sesję, aby ją załadować. Sesje zachowują się po restarcie.',
  },
  nav_flows: {
    title: 'Przepływy Automatyzacji',
    description: 'Buduj wizualne potoki AI za pomocą edytora węzłów. Łącz węzły Prompt → AI → Shell → Output.',
    tip: 'Kliknij prawym przyciskiem na kanwie, aby dodać węzeł.',
  },
  nav_gallery: {
    title: 'Galeria Zdjęć',
    description: 'Przeglądaj wszystkie zdjęcia zrobione kamerą. Zdjęcia są automatycznie archiwizowane do Vault.',
    tip: 'Kliknij zdjęcie, aby wysłać je do czatu do analizy AI.',
  },
  nav_settings: {
    title: 'Ustawienia',
    description: 'Konfiguruj dostawcę AI, model, personę, agenta OS, pamięć RAG, bota Telegram i inne.',
    tip: 'Użyj Ollamy do w 100% offline, lokalnego AI. Zainstaluj z ollama.com.',
  },
  nav_theme: {
    title: 'Motyw',
    description: 'Przełączaj między jasnym, ciemnym i motywem systemowym. Aplikacja automatycznie dostosowuje się do preferencji OS.',
    tip: 'Motyw systemowy śledzi ustawienie ciemnego/jasnego trybu systemu.',
  },
  nav_templates: {
    title: 'Szablony Promptów',
    description: 'Gotowe szablony promptów do typowych zadań: przegląd kodu, analiza, szkicowanie maili itp.',
    tip: 'Kliknij szablon, aby załadować go natychmiast do pola wpisywania.',
  },
  nav_tutorial: {
    title: 'Tryb Samouczka',
    description: 'Gdy WŁĄCZONY, najedź na dowolny element UI, aby zobaczyć krótkie wyjaśnienie jego funkcji.',
    tip: 'Wyłącz po zapoznaniu się z aplikacją.',
  },
  chat_attach: {
    title: 'Dołącz Pliki',
    description: 'Dołącz obrazy, PDF lub pliki tekstowe do wiadomości. AI przeczyta i przeanalizuje treść.',
    tip: 'Obsługiwane: JPG, PNG, WebP, PDF, TXT, MD, JSON, CSV, HTML, pliki kodu.',
  },
  chat_camera: {
    title: 'Kamera',
    description: 'Zrób zdjęcie kamerą internetową lub podłączoną kamerą (GoPro, telefon) do analizy AI.',
    tip: 'Po zrobieniu zdjęcia kliknij ikonę skanowania, aby uruchomić lokalną wizję AI.',
  },
  chat_vision: {
    title: 'Analiza Wizji',
    description: 'Analizuj dołączony obraz lokalnym modelem Ollama (qwen2.5vl, llava itd.).',
    tip: 'Wybierz: OCR (odczytaj tekst), Opisz lub Wyodrębnij pola JSON.',
  },
  chat_telegram: {
    title: 'Wyślij do Telegrama',
    description: 'Wyślij cały transkrypt sesji do podłączonego bota Telegram jako dokument.',
    tip: 'Najpierw skonfiguruj bota w Ustawienia → zakładka Telegram.',
  },
  chat_documents: {
    title: 'Vault / Dokumenty',
    description: 'Otwórz skarbiec dokumentów. Przeglądaj, pobieraj lub usuwaj pliki wygenerowane przez AI.',
    tip: 'Poproś AI o stworzenie dokumentu: "Zapisz to jako notatki.md"',
  },
  chat_export: {
    title: 'Eksport Sesji',
    description: 'Eksportuj aktualną sesję czatu jako profesjonalne PDF, plik Markdown lub udostępnij przez email.',
    tip: 'PDF jest generowany po stronie serwera z czystym formatowaniem.',
  },
  chat_clear: {
    title: 'Wyczyść Czat',
    description: 'Czyści wiadomości sesji z widoku. Historia sesji jest zachowana w panelu Sesje.',
    tip: 'To tylko czyści widok — użyj panelu Sesje, aby trwale usunąć.',
  },
  settings_provider: {
    title: 'Dostawca AI',
    description: 'Wybierz backend AI: Ollama (lokalny, offline), OpenAI (GPT-4), Google Gemini lub Anthropic (Claude).',
    tip: 'Ollama wymaga aplikacji Ollama działającej lokalnie na porcie 11434.',
  },
  settings_params: {
    title: 'Parametry Modelu',
    description: 'Dostosuj generowanie odpowiedzi: Temperatura (kreatywność), Top-P (różnorodność), Maks. tokeny (długość).',
    tip: 'Wyższa temperatura = bardziej kreatywne, ale mniej przewidywalne odpowiedzi.',
  },
  settings_prompt: {
    title: 'Prompt Systemowy',
    description: 'Prompt systemowy definiuje zachowanie AI dla każdej rozmowy. Dostosuj osobowość, rolę i ograniczenia.',
    tip: 'Zmiany wchodzą w życie od następnej wiadomości.',
  },
  settings_vision: {
    title: 'Wizja i RAG',
    description: 'Konfiguruj lokalną analizę obrazów (Wizja) i semantyczne przeszukiwanie pamięci między sesjami (RAG).',
    tip: 'RAG wymaga Ollamy + modelu nomic-embed-text: ollama pull nomic-embed-text',
  },
  settings_persona: {
    title: 'Tryb Persony',
    description: 'Nadaj AI własną nazwę i kontroluj styl odpowiedzi. Minimalny/Brak usuwa zastrzeżenia AI.',
    tip: 'Dla Ograniczeń: Brak, użyj niecenzurowanego modelu Ollama jak dolphin-mistral.',
  },
  settings_agent: {
    title: 'Agent Plików OS',
    description: 'Daj AI dostęp do odczytu, wyszukiwania, zapisu i dołączania plików na lokalnym systemie plików.',
    tip: 'Zapytaj: "Znajdź pliki PDF w ~/Downloads" lub "Dodaj wiersz do ~/Desktop/log.csv"',
  },
  settings_telegram: {
    title: 'Bot Telegram',
    description: 'Podłącz bota Telegram, aby rozmawiać z AI z telefonu. Obsługuje komendy /chat, /ask, /search.',
    tip: 'Utwórz bota przez @BotFather na Telegramie, aby otrzymać token.',
  },
  settings_language: {
    title: 'Język',
    description: 'Przełączaj interfejs aplikacji między angielskim a polskim. AI odpowiada w języku, w którym piszesz.',
    tip: 'AI wykrywa język automatycznie — pisz po polsku, otrzymuj polskie odpowiedzi.',
  },
  persona_restriction: {
    title: 'Poziom Ograniczeń',
    description: 'Standardowy: normalne zachowanie AI. Minimalny: usuwa "Jako AI…". Brak: w pełni niecenzurowane odpowiedzi.',
    tip: 'Używaj Brak tylko z niecenzurowanymi lokalnymi modelami (dolphin, wizard-vicuna).',
  },
  persona_name: {
    title: 'Nazwa Persony',
    description: 'Nadaj AI własną nazwę. Będzie się przedstawiać i być adresowana tym imieniem w całych rozmowach.',
    tip: 'Pozostaw puste, aby zachować domyślną tożsamość "Charbot".',
  },
  persona_behavior: {
    title: 'Niestandardowe Zachowanie',
    description: 'Dodatkowe instrukcje zachowania dołączane do każdego promptu systemowego. Definiuj ton, format lub reguły.',
    tip: 'Przykład: "Zawsze odpowiadaj punktorami. Używaj formalnego języka."',
  },
  agent_dirs: {
    title: 'Dozwolone Katalogi',
    description: 'AI może uzyskać dostęp tylko do plików w tych katalogach. Dodawaj lub usuwaj ścieżki, aby kontrolować zakres.',
    tip: 'Używaj ~/Downloads, ~/Desktop, ~/Documents dla bezpiecznego dostępu.',
  },
  agent_toggle: {
    title: 'Agent Plików OS',
    description: 'Gdy włączony, AI może listować, czytać, zapisywać pliki za pomocą wywołań narzędzi XML w odpowiedziach.',
    tip: 'Obserwuj bąbelki <tool_call> w czacie — pokazują co robi AI.',
  },
  rag_toggle: {
    title: 'Pamięć RAG',
    description: 'Semantyczne przeszukiwanie wszystkich poprzednich sesji. AI automatycznie wstrzykuje powiązane fragmenty.',
    tip: 'Wymaga Ollamy + nomic-embed-text. Indeks buduje się podczas rozmowy.',
  },
  finetune: {
    title: 'Stwórz Własny Model',
    description: 'Zbuduj nowy model Ollama z wbudowanym promptem systemowym za pomocą Modelfile. Bez danych treningowych.',
    tip: 'Przykład: baza=llama3, nazwa=mój-prawnik, prompt = "Jesteś ekspertem prawnym…"',
  },
  export_panel: {
    title: 'Profesjonalny Eksport',
    description: 'Eksportuj sesję jako sformatowany PDF (generowany serwerowo), plik Markdown lub udostępnij przez email.',
    tip: 'PDF jest zapisywany do ~/CharbotVault/documents/ i automatycznie otwierany do pobrania.',
  },
};

export const TUTORIALS: Record<'en' | 'pl', Record<TutorialKey, TutorialEntry>> = { en, pl };

export type { TutorialKey };
