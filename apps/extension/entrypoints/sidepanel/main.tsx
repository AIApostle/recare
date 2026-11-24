import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../../styles/globals.css';

// Prevent Chrome from logging unhandled on-device execution config errors to chrome://extensions
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason || '');
    if (reasonStr.includes('execution config') || reasonStr.includes('LanguageModel')) {
      event.preventDefault();
      console.info('[Recare] Handled on-device model background state: using cloud fallback.');
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
