import React, { createContext, useContext, useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------
export type Lang = 'en' | 'pl';

const translations = {
  en: {
    // App / Layout
    appName: 'Charbot OS',
    idle: 'Idle',
    systemReady: 'System Ready',
    neuralInterfaceActive: 'Neural Interface Active',
    thinking: 'Thinking...',

    // Nav tabs
    chat: 'Chat',
    sessions: 'Sessions',
    gallery: 'Gallery',
    flows: 'Flows',
    settings: 'Settings',

    // Chat
    startNewSession: 'Start New Session',
    configureApiKeys: 'Configure API Keys',
    howCanIHelp: 'How can I help you?',
    typeOrDropFiles: 'Type a message or drop files to start the conversation.',
    typeMessage: 'Type a message...',
    addMessageOrSend: 'Add a message or send files...',
    dragDropHint: 'Drag & drop · 📎 files · 📷 camera · Ctrl+V paste',
    enterToSend: 'Enter to send · Shift+Enter new line',
    you: 'You',
    charbot: 'Charbot',
    clearChat: 'Clear Chat',
    sendToTelegram: 'Send session to Telegram',
    documents: 'Documents (Vault)',
    dropFilesToAnalyze: 'Drop files to analyze',
    supported: 'Supported',
    readFile: 'Read file…',
    systemError: 'SYSTEM ERROR',

    // Sessions
    noSessions: 'No sessions yet.',
    newSession: 'New Session',
    deleteSession: 'Delete session',
    session: 'Session',

    // Gallery
    noPhotos: 'No photos yet.',
    capturePhoto: 'Capture Photo',
    deletePhoto: 'Delete photo',

    // Settings
    systemConfig: 'System Configuration',
    provider: 'Provider',
    parameters: 'Parameters',
    systemPrompt: 'System',
    visionRag: 'Vision & RAG',
    telegram: 'Telegram',
    language: 'Language',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    aiProvider: 'AI Provider',
    ollamaEndpoint: 'Ollama Endpoint',
    endpointUrl: 'Endpoint URL',
    model: 'Model',
    apiKey: 'API Key',
    active: 'Active',
    notConnected: 'Not connected',
    fineTuneResponses: 'Fine-tune Responses',
    adjustCreativity: 'Adjust creativity and randomness of the engine.',
    temperature: 'Temperature',
    precise: 'Precise',
    creative: 'Creative',
    topP: 'Top-P',
    focused: 'Focused',
    random: 'Random',
    maxTokens: 'Max Tokens',
    systemPromptLabel: 'System Prompt',
    systemPromptDesc: 'This prompt is sent at the start of every conversation to define the assistant\'s behavior.',
    systemPromptPlaceholder: 'You are a helpful assistant...',

    // Vision
    visionImageAnalysis: 'Vision (Image Analysis)',
    localVisionModel: 'Local Vision Model',
    localVisionDesc: 'Requires Ollama. Install with:',
    visionModel: 'Vision Model',
    visionOtherOptions: 'Other options: llava, moondream, llava-phi3',

    // RAG
    ragMemory: 'RAG Memory (Semantic Search)',
    crossSessionMemory: 'Cross-Session Memory',
    ragDesc: 'Finds similar past exchanges and injects them as context. Requires Ollama +',
    enableRag: 'Enable RAG Memory',
    ragInjects: 'Injects top-4 similar past messages into every prompt',
    embeddingModel: 'Embedding Model',

    // Telegram
    botConnected: 'Bot Connected',
    disconnect: 'Disconnect',
    waitingRegister: 'Step 2 — Open bot & register',
    waitingRegisterDesc: 'Bot is running. Now open it in Telegram and send',
    openInTelegram: 'Open in Telegram',
    waitingAutoRefresh: 'Waiting for /register… (auto-refreshing)',
    step1GetToken: '1. Get token',
    step2Connect: '2. Connect',
    step3Register: '3. Register',
    step1Desc: 'Open Telegram → message',
    step1Desc2: '→ send /newbot → copy the token.',
    step2Label: 'Step 2 — Paste token & connect',
    step3Label: 'Step 3 — Register in Telegram',
    step3Desc: 'After connecting, open your bot and send /register. Done.',
    connectBot: 'Connect Bot',
    connecting: 'Connecting…',
    pasteBotToken: 'Paste your Bot Token first',
    commands: 'Commands',
    updateProvider: 'Update Provider',
    saving: 'Saving…',

    // Documents
    vaultDocuments: 'Vault / Documents',
    noDocuments: 'No documents yet.\nAsk the AI to create one!',
    askAiDocHint: 'Ask the AI to create documents using:',
    savedTo: 'Saved to: ~/CharbotVault/documents/',

    // Automation / Flows
    executeFlow: 'Execute',
    addNode: 'Add Node',
    saveFlow: 'Save',
    nodeConfig: 'Node Config',
    apply: 'Apply',
    duplicate: 'Duplicate',

    // Camera
    takePhoto: 'Take a photo (webcam / GoPro / external camera)',
    attachFiles: 'Attach files (images, text, PDF)',
    analyzeImage: 'Analyze with local vision AI (Ollama)',

    // Vision presets
    readText: 'Read text (OCR)',
    describeImage: 'Describe image',
    extractFields: 'Extract fields (JSON)',
    visionSelectMode: 'Vision · Select mode',

    // Language
    languageLabel: 'App Language',
    english: 'English',
    polish: 'Polish',

    // Persona
    persona: 'Persona',
    personaModeLabel: 'Persona Mode',
    personaModeDesc: 'Override the AI\'s name, identity, and response restrictions.',
    personaNameLabel: 'Persona Name',
    personaNamePlaceholder: 'e.g. Aria, Max, HAL',
    personaNameHint: 'Displayed in chat header when active.',
    restrictionLevel: 'Restriction Level',
    restrictionStandard: 'Standard',
    restrictionStandardDesc: 'Default behavior with normal safety guidelines.',
    restrictionMinimal: 'Minimal',
    restrictionMinimalDesc: 'No "As an AI…" disclaimers. Direct and concise answers.',
    restrictionNone: 'None',
    restrictionNoneDesc: 'Uncensored — answers all questions without refusals.',
    uncensoredModelTip: 'Tip for Ollama users:',
    uncensoredModelList: 'For best results with Restriction: None, use an uncensored model:',
    personaBehavior: 'Custom Behavior',
    personaBehaviorPlaceholder: 'e.g. Always respond in bullet points. Use formal language.',

    // OS Agent
    osAgent: 'Agent',
    osAgentLabel: 'OS File Agent',
    enableOsAgent: 'Enable OS File Agent',
    osAgentDesc: 'Allows AI to list, search, read, write, and append files on your local filesystem.',
    allowedDirs: 'Allowed Directories',
    allowedDirsDesc: 'AI can only access files within these directories.',
    addDirectory: 'Add Directory',
    osAgentWarning: 'Warning: The AI can read and modify files in these directories. Only enable if you trust the AI with this access.',

    // Fine-tuning
    createCustomModel: 'Create Custom Model',
    createCustomModelDesc: 'Build an Ollama Modelfile with a built-in system prompt.',
    baseModel: 'Base Model',
    newModelName: 'New Model Name',
    customSystemPrompt: 'Custom System Prompt',
    customSystemPromptPlaceholder: 'You are a specialized assistant for...',
    createModel: 'Create Model',
    creatingModel: 'Creating…',
  },

  pl: {
    // App / Layout
    appName: 'Charbot OS',
    idle: 'Bezczynny',
    systemReady: 'System Gotowy',
    neuralInterfaceActive: 'Interfejs Neural Aktywny',
    thinking: 'Myślę...',

    // Nav tabs
    chat: 'Czat',
    sessions: 'Sesje',
    gallery: 'Galeria',
    flows: 'Przepływy',
    settings: 'Ustawienia',

    // Chat
    startNewSession: 'Nowa Sesja',
    configureApiKeys: 'Skonfiguruj Klucze API',
    howCanIHelp: 'W czym mogę pomóc?',
    typeOrDropFiles: 'Wpisz wiadomość lub upuść pliki, aby rozpocząć rozmowę.',
    typeMessage: 'Wpisz wiadomość...',
    addMessageOrSend: 'Dodaj wiadomość lub wyślij pliki...',
    dragDropHint: 'Przeciągnij i upuść · 📎 pliki · 📷 kamera · Ctrl+V wklej',
    enterToSend: 'Enter — wyślij · Shift+Enter — nowa linia',
    you: 'Ty',
    charbot: 'Charbot',
    clearChat: 'Wyczyść Czat',
    sendToTelegram: 'Wyślij sesję do Telegrama',
    documents: 'Dokumenty (Vault)',
    dropFilesToAnalyze: 'Upuść pliki do analizy',
    supported: 'Obsługiwane',
    readFile: 'Wczytuję plik…',
    systemError: 'BŁĄD SYSTEMU',

    // Sessions
    noSessions: 'Brak sesji.',
    newSession: 'Nowa Sesja',
    deleteSession: 'Usuń sesję',
    session: 'Sesja',

    // Gallery
    noPhotos: 'Brak zdjęć.',
    capturePhoto: 'Zrób Zdjęcie',
    deletePhoto: 'Usuń zdjęcie',

    // Settings
    systemConfig: 'Konfiguracja Systemu',
    provider: 'Dostawca',
    parameters: 'Parametry',
    systemPrompt: 'System',
    visionRag: 'Wizja & RAG',
    telegram: 'Telegram',
    language: 'Język',
    saveChanges: 'Zapisz Zmiany',
    cancel: 'Anuluj',
    aiProvider: 'Dostawca AI',
    ollamaEndpoint: 'Endpoint Ollama',
    endpointUrl: 'URL Endpointu',
    model: 'Model',
    apiKey: 'Klucz API',
    active: 'Aktywny',
    notConnected: 'Niepołączony',
    fineTuneResponses: 'Dostosuj Odpowiedzi',
    adjustCreativity: 'Reguluj kreatywność i losowość silnika.',
    temperature: 'Temperatura',
    precise: 'Precyzyjny',
    creative: 'Kreatywny',
    topP: 'Top-P',
    focused: 'Skupiony',
    random: 'Losowy',
    maxTokens: 'Maks. Tokeny',
    systemPromptLabel: 'Prompt Systemowy',
    systemPromptDesc: 'Ten prompt jest wysyłany na początku każdej rozmowy, aby zdefiniować zachowanie asystenta.',
    systemPromptPlaceholder: 'Jesteś pomocnym asystentem...',

    // Vision
    visionImageAnalysis: 'Wizja (Analiza Obrazu)',
    localVisionModel: 'Lokalny Model Wizji',
    localVisionDesc: 'Wymaga Ollamy. Zainstaluj przez:',
    visionModel: 'Model Wizji',
    visionOtherOptions: 'Inne opcje: llava, moondream, llava-phi3',

    // RAG
    ragMemory: 'Pamięć RAG (Wyszukiwanie Semantyczne)',
    crossSessionMemory: 'Pamięć Między-sesyjna',
    ragDesc: 'Znajdzie podobne poprzednie wymiany i wstrzyknie je jako kontekst. Wymaga Ollamy +',
    enableRag: 'Włącz Pamięć RAG',
    ragInjects: 'Wstrzykuje 4 najlepiej pasujące poprzednie wiadomości do każdego promptu',
    embeddingModel: 'Model Osadzania',

    // Telegram
    botConnected: 'Bot Połączony',
    disconnect: 'Rozłącz',
    waitingRegister: 'Krok 2 — Otwórz bota i zarejestruj się',
    waitingRegisterDesc: 'Bot działa. Otwórz go w Telegramie i wyślij',
    openInTelegram: 'Otwórz w Telegramie',
    waitingAutoRefresh: 'Czekam na /register… (odświeżanie automatyczne)',
    step1GetToken: '1. Pobierz token',
    step2Connect: '2. Połącz',
    step3Register: '3. Zarejestruj',
    step1Desc: 'Otwórz Telegram → napisz do',
    step1Desc2: '→ wyślij /newbot → skopiuj token.',
    step2Label: 'Krok 2 — Wklej token i połącz',
    step3Label: 'Krok 3 — Zarejestruj się w Telegramie',
    step3Desc: 'Po połączeniu otwórz bota i wyślij /register. Gotowe.',
    connectBot: 'Połącz Bota',
    connecting: 'Łączenie…',
    pasteBotToken: 'Najpierw wklej Token Bota',
    commands: 'Komendy',
    updateProvider: 'Zaktualizuj Dostawcę',
    saving: 'Zapisuję…',

    // Documents
    vaultDocuments: 'Vault / Dokumenty',
    noDocuments: 'Brak dokumentów.\nPoproś AI, żeby coś stworzyła!',
    askAiDocHint: 'Poproś AI o stworzenie dokumentu używając:',
    savedTo: 'Zapisano do: ~/CharbotVault/documents/',

    // Automation / Flows
    executeFlow: 'Wykonaj',
    addNode: 'Dodaj węzeł',
    saveFlow: 'Zapisz',
    nodeConfig: 'Konfiguracja węzła',
    apply: 'Zastosuj',
    duplicate: 'Duplikuj',

    // Camera
    takePhoto: 'Zrób zdjęcie (kamera / GoPro / zewnętrzna)',
    attachFiles: 'Dołącz pliki (obrazy, tekst, PDF)',
    analyzeImage: 'Analizuj lokalnym modelem wizji (Ollama)',

    // Vision presets
    readText: 'Odczytaj tekst (OCR)',
    describeImage: 'Opisz obraz',
    extractFields: 'Wyodrębnij pola (JSON)',
    visionSelectMode: 'Wizja · Wybierz tryb',

    // Language
    languageLabel: 'Język Aplikacji',
    english: 'Angielski',
    polish: 'Polski',

    // Persona
    persona: 'Persona',
    personaModeLabel: 'Tryb Persony',
    personaModeDesc: 'Nadpisz nazwę, tożsamość i poziom ograniczeń AI.',
    personaNameLabel: 'Nazwa Persony',
    personaNamePlaceholder: 'np. Aria, Max, HAL',
    personaNameHint: 'Wyświetlana w nagłówku czatu gdy aktywna.',
    restrictionLevel: 'Poziom Ograniczeń',
    restrictionStandard: 'Standardowy',
    restrictionStandardDesc: 'Domyślne zachowanie z normalnymi wytycznymi bezpieczeństwa.',
    restrictionMinimal: 'Minimalny',
    restrictionMinimalDesc: 'Bez "Jako AI…". Bezpośrednie i zwięzłe odpowiedzi.',
    restrictionNone: 'Brak',
    restrictionNoneDesc: 'Bez cenzury — odpowiada na wszystkie pytania bez odmów.',
    uncensoredModelTip: 'Wskazówka dla użytkowników Ollamy:',
    uncensoredModelList: 'Dla najlepszych efektów z Ograniczenia: Brak, użyj modelu bez cenzury:',
    personaBehavior: 'Niestandardowe zachowanie',
    personaBehaviorPlaceholder: 'np. Zawsze odpowiadaj punktorami. Używaj formalnego języka.',

    // OS Agent
    osAgent: 'Agent',
    osAgentLabel: 'Agent Plików OS',
    enableOsAgent: 'Włącz Agenta Plików OS',
    osAgentDesc: 'Pozwala AI przeglądać, szukać, czytać, zapisywać i dołączać pliki na lokalnym systemie.',
    allowedDirs: 'Dozwolone Katalogi',
    allowedDirsDesc: 'AI może uzyskać dostęp tylko do plików w tych katalogach.',
    addDirectory: 'Dodaj Katalog',
    osAgentWarning: 'Uwaga: AI może czytać i modyfikować pliki w tych katalogach. Włącz tylko jeśli ufasz AI z tym dostępem.',

    // Fine-tuning
    createCustomModel: 'Stwórz Własny Model',
    createCustomModelDesc: 'Zbuduj Ollama Modelfile z wbudowanym promptem systemowym.',
    baseModel: 'Model Bazowy',
    newModelName: 'Nazwa Nowego Modelu',
    customSystemPrompt: 'Niestandardowy Prompt Systemowy',
    customSystemPromptPlaceholder: 'Jesteś wyspecjalizowanym asystentem do...',
    createModel: 'Stwórz Model',
    creatingModel: 'Tworzenie…',
  },
} as const;

export type T = typeof translations.en;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: T;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: translations.en,
});

const STORAGE_KEY = 'charbot_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved === 'pl' || saved === 'en') ? saved : 'en';
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] as T }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
