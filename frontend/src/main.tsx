import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { AppRouter } from './routes/AppRouter';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Handle dynamic import failures when Vite chunk hashes change after deployments
window.addEventListener('vite:preloadError', (event) => {
  const retryKey = 'aralert_chunk_retry_timestamp';
  const lastRetry = sessionStorage.getItem(retryKey);
  const now = Date.now();
  if (!lastRetry || now - Number(lastRetry) > 12000) {
    sessionStorage.setItem(retryKey, String(now));
    console.warn('[Vite] Preload error detected. Automatically reloading latest bundle...', event);
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

