import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LocaleProvider } from './i18n';
import './styles/tokens.css';
import './styles/global.css';
import './styles/app.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element fehlt.');
}

createRoot(container).render(
  <StrictMode>
    <LocaleProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </LocaleProvider>
  </StrictMode>,
);
