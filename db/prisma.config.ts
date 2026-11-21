import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'prisma/config';

// Prisma 7 no carga .env por sí solo: usamos el cargador nativo de Node (sin dotenv).
const rootEnv = fileURLToPath(new URL('../.env', import.meta.url));
if (!process.env.DATABASE_URL && existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://nova:nova@localhost:5433/nova',
  },
});
