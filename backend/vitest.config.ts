import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// En CI, TEST_DATABASE_URL apunta al servicio de PostgreSQL (puerto 5432).
// En local, al contenedor de docker compose (puerto 5433).
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://nova:nova@localhost:5433/nova_test';

export default defineConfig({
  // «development» se AGREGA a las condiciones por defecto (research R11). Reemplazarlas haría
  // que algunas librerías se cargaran en su versión CommonJS y duplicaran Zod.
  resolve: { conditions: ['development', ...defaultClientConditions] },
  ssr: {
    resolve: {
      conditions: ['development', ...defaultServerConditions],
      externalConditions: ['development'],
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Las pruebas de integración comparten la base nova_test: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      APP_ORIGIN: 'http://localhost:5173',
      JWT_ACCESS_SECRET: 'test-jwt-secret-que-no-se-usa-fuera-de-pruebas-0001',
      CODE_HMAC_SECRET: 'test-hmac-secret-que-no-se-usa-fuera-de-pruebas-0002',
      STUDENT_EMAIL_DOMAINS: 'nova-test.edu.co',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      MAIL_FROM: 'Nova <no-reply@nova.test>',
      LOG_LEVEL: 'silent',
      // Límites bajos para ejercitar el tope diario con pocas recargas (spec 002).
      TOPUP_MIN_AMOUNT: '1000',
      TOPUP_MAX_AMOUNT: '50000',
      TOPUP_DAILY_LIMIT: '100000',
      // Spec 003: mínimo, umbral de contraseña, máximo y tope diario de envíos.
      TRANSFER_MIN_AMOUNT: '1000',
      TRANSFER_REAUTH_THRESHOLD: '20000',
      TRANSFER_MAX_AMOUNT: '50000',
      TRANSFER_DAILY_LIMIT: '60000',
      // Spec 004: clave de prueba (nunca se usa fuera de pruebas) y límites de pago con tarjeta.
      CARD_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      CARD_PAYMENT_MIN_AMOUNT: '1000',
      CARD_PAYMENT_MAX_AMOUNT: '50000',
      CARD_PAYMENT_DAILY_LIMIT: '60000',
    },
  },
});
