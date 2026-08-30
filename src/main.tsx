import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from './lib/i18n/i18n';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/error-boundary';
import { registerServiceWorker } from './registerServiceWorker';
import { initSentry } from './lib/sentry';

initSentry();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </ErrorBoundary>
  </StrictMode>,
);
