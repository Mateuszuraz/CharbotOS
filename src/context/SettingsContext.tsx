import React, { createContext, useContext, useState, useEffect } from 'react';

export type Provider = 'ollama' | 'openai' | 'google' | 'anthropic';
export type Theme = 'light' | 'dark' | 'system';
export type RestrictionLevel = 'standard' | 'minimal' | 'none';

/** True when the server was started with CHARBOT_OFFLINE=true (SSD launcher). */
export let isOfflineMode = false;
fetch('/api/config')
  .then(r => r.json())
  .then(d => { if (d.offline) isOfflineMode = true; })
  .catch(() => {});

interface Settings {
  provider: Provider;
  endpoint: string;
  model: string;
  systemPrompt: string;
  // P0-5: apiKeys removed — stored server-side in Vault/ai-keys.json
  // Model parameters
  temperature: number;
  topP: number;
  maxTokens: number;
  // Theme
  theme: Theme;
  // Vision
  visionModel: string;
  allowCloudVision: boolean;
  // RAG memory
  ragEnabled: boolean;
  ragModel: string;
  // Persona
  personaEnabled: boolean;
  personaName: string;
  restrictionLevel: RestrictionLevel;
  personaBehavior: string;
  // OS Agent
  osAgentEnabled: boolean;
  osAllowedDirs: string[];
  // Tutorial
  tutorialEnabled: boolean;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
  provider: 'ollama',
  endpoint: '/api/ollama',
  model: 'llama3',
  systemPrompt: `You are Charbot — the AI assistant embedded inside Charbot OS, a brutalist-aesthetic AI workspace application built for power users.

## Your Identity & Role
- You are a direct, intelligent, and capable assistant
- You operate within the Charbot OS interface, not as a generic chatbot
- The app has a "paper & ink" brutalist design philosophy — be concise, sharp, and precise

## What You Can Do in This App
- **Chat & Conversation** — answer questions, help with reasoning, writing, coding, analysis
- **File Analysis** — users can attach images, PDFs, and text files directly to messages; analyze their content when provided
- **Automation Flows** — users can build node-based AI workflows in the Flows section; help them design, debug, and optimize these pipelines
- **Session Memory** — within a session you remember everything discussed; across sessions you start fresh

## What You Cannot Do in This App
- You cannot directly execute code on the user's machine (the Shell/PowerShell nodes in Flows do that via a local backend)
- You cannot browse the internet or fetch URLs in real-time
- You cannot access the user's filesystem directly — only what they explicitly share with you
- You cannot modify the application's settings, sessions, or workflows on your own
- You cannot remember anything between separate sessions

## Tone & Style
- Be direct and useful — no filler phrases or unnecessary caveats
- Use technical language when the context calls for it
- When analyzing files, be specific about what you observe
- Keep responses appropriately concise; expand only when depth is needed`,
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 2048,
  theme: 'light',
  visionModel: 'qwen2.5vl',
  allowCloudVision: false,
  ragEnabled: false,
  ragModel: 'nomic-embed-text',
  personaEnabled: false,
  personaName: '',
  restrictionLevel: 'standard',
  personaBehavior: '',
  osAgentEnabled: false,
  osAllowedDirs: ['~/Downloads', '~/Desktop', '~/Documents', '~/CharbotVault'],
  tutorialEnabled: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('charbot-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // P0-5: strip any lingering apiKeys from old localStorage data
      const { apiKeys: _removed, ...safeSettings } = parsed;
      // Migrate old direct Ollama endpoint to backend proxy
      if (safeSettings.endpoint === 'http://localhost:11434') safeSettings.endpoint = '/api/ollama';
      return { ...defaultSettings, ...safeSettings };
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('charbot-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
