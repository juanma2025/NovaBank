/**
 * Playwright de Nova (spec 001, tasks.md T011; research R14: un solo origen).
 *
 * `webServer` aplica las migraciones a `nova_e2e` y arranca el backend COMPILADO (ejecuta antes
 * `npm run build` en la raíz). Si existe `frontend/dist`, el backend también sirve el frontend
 * (`SERVE_FRONTEND=true`); mientras el frontend no esté en `main`, solo corren las pruebas de API.
 *
 * Usa el puerto 3100 (no el 3000 de desarrollo) para no reutilizar por error un servidor de
 * desarrollo conectado a la base `nova`.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;
export const HAS_FRONTEND = existsSync(new URL('../frontend/dist/index.html', import.meta.url));

// Local: contenedor de docker compose (puerto 5433). CI: servicio de PostgreSQL (E2E_DATABASE_URL).
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://nova:nova@localhost:5433/nova_e2e';

/** Entorno completo y explícito: no depende del `.env` de quien ejecuta las pruebas. */
const serverEnv: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: String(PORT),
  APP_ORIGIN: BASE_URL,
  LOG_LEVEL: 'warn',
  SERVE_FRONTEND: String(HAS_FRONTEND),
  DATABASE_URL,
  JWT_ACCESS_SECRET: 'e2e-jwt-secret-que-no-se-usa-fuera-de-pruebas-0001',
  CODE_HMAC_SECRET: 'e2e-hmac-secret-que-no-se-usa-fuera-de-pruebas-0002',
  STUDENT_EMAIL_DOMAINS: 'nova-test.edu.co',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_SECURE: 'false',
  MAIL_FROM: 'Nova <no-reply@nova.test>',
  // Inactividad corta para probar «Seguir conectado» (spec 001, US2).
  SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE: '20',
  SESSION_IDLE_WARNING_SECONDS_OVERRIDE: '8',
  // Clave de prueba (spec 004); nunca se usa fuera de E2E.
  CARD_ENCRYPTION_KEY:
    process.env.CARD_ENCRYPTION_KEY ??
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  // Las pruebas comparten la base nova_e2e: en serie, como las de integración del backend.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Diseño adaptable desde 360 px (criterios de éxito de todas las specs).
    {
      name: 'movil-360',
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } },
    },
  ],
  webServer: {
    command: 'npm run db:deploy && node backend/dist/server.js',
    cwd: ROOT,
    url: `${BASE_URL}/api/v1/health`,
    env: serverEnv,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
