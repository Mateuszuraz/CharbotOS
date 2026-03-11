import { useState, useEffect, useCallback, useRef } from 'react';
import { Provider } from '@/context/SettingsContext';

interface ModelListState {
  models: string[];
  loading: boolean;
  error: string | null;
}

async function fetchOllamaModels(endpoint: string): Promise<string[]> {
  const res = await fetch(`${endpoint}/api/tags`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.models ?? []).map((m: { name: string }) => m.name).sort();
}

// P0-5: cloud model lists fetched through backend (no API keys in browser)
async function fetchCloudModels(provider: string): Promise<string[]> {
  const res = await fetch(`/api/ai/models?provider=${provider}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { models?: string[]; error?: string };
  if (data.error) throw new Error(data.error);
  return data.models ?? [];
}

export function useModelList({
  provider,
  endpoint,
}: {
  provider: Provider | 'room-server';
  endpoint?: string;
  apiKey?: string; // kept for API compatibility but no longer used
}) {
  const [state, setState] = useState<ModelListState>({
    models: [],
    loading: false,
    error: null,
  });

  const fetchModels = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      let models: string[] = [];
      if (provider === 'room-server') {
        // Fetch models through the server proxy — always returns server's Ollama models
        const r = await fetch(endpoint ?? '/api/rooms/models');
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        models = data.models ?? [];
      } else if (provider === 'ollama') {
        models = await fetchOllamaModels(endpoint || 'http://localhost:11434');
      } else {
        models = await fetchCloudModels(provider);
      }
      setState({ models, loading: false, error: null });
    } catch (err) {
      setState({ models: [], loading: false, error: (err as Error).message });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, endpoint]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return { ...state, refresh: fetchModels };
}
