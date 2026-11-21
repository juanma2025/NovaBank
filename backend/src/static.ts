import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import express, { type Express } from 'express';

/**
 * En producción y E2E, Express sirve el build del frontend desde el mismo origen que la API
 * (research R14: SameSite=Strict exige un solo sitio). Las rutas que no son /api devuelven
 * index.html para que React Router las resuelva.
 */
export function serveFrontend(app: Express): void {
  const dist = fileURLToPath(new URL('../../frontend/dist', import.meta.url));
  if (!existsSync(dist)) {
    throw new Error(`SERVE_FRONTEND=true pero no existe ${dist}: ejecuta npm run build`);
  }
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile('index.html', { root: dist, maxAge: 0 });
  });
}
