import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontró el elemento raíz #root');
}

createRoot(rootElement).render(
  <StrictMode>
    <main>Nova</main>
  </StrictMode>,
);
