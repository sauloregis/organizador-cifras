import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { requestPersistentStorage } from './lib/db';
import { seedIfFirstRun } from './lib/seed';
import './styles.css';

// Service worker: guarda o app no aparelho para funcionar sem internet
// e se atualiza sozinho quando houver versão nova.
registerSW({ immediate: true });
requestPersistentStorage();
seedIfFirstRun();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
