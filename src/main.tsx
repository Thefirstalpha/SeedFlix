import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/index.css';

if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/web-push-sw.js').catch((error) => {
			console.error('Web push service worker registration failed:', error);
		});
	});
}

createRoot(document.getElementById('root')!).render(<App />);
