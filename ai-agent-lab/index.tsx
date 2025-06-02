import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HashRouter } from 'react-router-dom';

// Removed ensureIconsExist function as it's not effective for SW caching
// and causes console warnings. Actual icons should be present in the public/icons directory
// for PWA manifest and SW caching (if explicitly listed in sw.js) to work correctly.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);