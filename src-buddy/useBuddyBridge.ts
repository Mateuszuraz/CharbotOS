import { useEffect, useState } from 'react';

export type BuddyEmotion = 'idle' | 'happy' | 'thinking' | 'surprised';

export interface BuddyState {
  emotion: BuddyEmotion;
  isTalking: boolean;
  isListening: boolean;
  lastMessage: string;
}

export function useBuddyBridge(serverUrl = 'http://127.0.0.1:3000'): BuddyState {
  const [state, setState] = useState<BuddyState>({
    emotion: 'idle',
    isTalking: false,
    isListening: false,
    lastMessage: '',
  });

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        es = new EventSource(`${serverUrl}/api/buddy/events`);

        es.addEventListener('talking', (e) => {
          const data = JSON.parse((e as MessageEvent).data);
          setState(s => ({ ...s, isTalking: data.value, emotion: data.value ? 'idle' : 'idle' }));
        });
        es.addEventListener('emotion', (e) => {
          const data = JSON.parse((e as MessageEvent).data);
          setState(s => ({ ...s, emotion: data.value as BuddyEmotion }));
        });
        es.addEventListener('message_chunk', (e) => {
          const data = JSON.parse((e as MessageEvent).data);
          setState(s => ({ ...s, isTalking: true, lastMessage: data.text }));
        });
        es.addEventListener('message_done', () => {
          setState(s => ({ ...s, isTalking: false }));
        });
        es.onerror = () => {
          es?.close();
          retryTimer = setTimeout(connect, 3000);
        };
      } catch {
        retryTimer = setTimeout(connect, 3000);
      }
    };

    connect();
    return () => {
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [serverUrl]);

  return state;
}
