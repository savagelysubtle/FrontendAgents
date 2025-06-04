
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './contexts/AppContext';

console.log("index.tsx: Module loaded.");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("index.tsx: Root element #root not found in the DOM.");
  throw new Error("Could not find root element to mount to");
}
console.log("index.tsx: Root element #root found.");

console.log("index.tsx: Attempting to create React root...");
const root = ReactDOM.createRoot(rootElement);
console.log("index.tsx: React root created.");

console.log("index.tsx: Attempting to render App component...");
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
console.log("index.tsx: App component render initiated.");