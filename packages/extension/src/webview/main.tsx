import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './App.js';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
