import React from 'react';
import ReactDOM from 'react-dom/client';
import { BuddyApp } from './BuddyApp';

ReactDOM.createRoot(document.getElementById('buddy-root')!).render(
  <React.StrictMode>
    <BuddyApp />
  </React.StrictMode>
);
