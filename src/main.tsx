/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// P0-11: fetch APP_SECRET before mounting, then intercept all /api/ calls
const _origFetch = window.fetch.bind(window);
let _appSecret = '';

window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url =
    typeof input === 'string' ? input
    : input instanceof URL ? input.toString()
    : (input as Request).url;
  if (_appSecret && url.startsWith('/api/')) {
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    headers.set('x-app-secret', _appSecret);
    return _origFetch(input, { ...(init as RequestInit), headers });
  }
  return _origFetch(input, init as RequestInit);
};

try {
  const r = await _origFetch('/api/init');
  const data = await r.json() as { appSecret?: string };
  if (data.appSecret) _appSecret = data.appSecret;
} catch { /* server not ready or offline — proceed without auth */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
