import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/web-push-sw.js')
      .then((registration) => {
        // Check for updates periodically
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('SeedFlix has a new update available.');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
