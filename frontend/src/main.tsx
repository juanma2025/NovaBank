import './styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { AppProviders, AppStartupGate, SessionProvider } from './app/providers.tsx';
import { AppRoutes } from './app/router.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontró el elemento raíz #root');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <BrowserRouter>
        <SessionProvider>
          <AppStartupGate>
            <AppRoutes />
          </AppStartupGate>
        </SessionProvider>
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
);
