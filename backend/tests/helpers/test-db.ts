import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createPrismaClient } from '@nova/db';

const dbDir = fileURLToPath(new URL('../../../db', import.meta.url));
const prismaCli = fileURLToPath(
  new URL('../../../node_modules/prisma/build/index.js', import.meta.url),
);

function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(`Las pruebas solo pueden reiniciar una base *_test (recibido: «${name}»)`);
  }
  return url;
}

/**
 * Reinicia nova_test: borra el esquema y aplica las migraciones (tasks.md T034).
 * No se puede vaciar audit_events por sus triggers de inmutabilidad, así que se recrea todo.
 * Se llama una vez por archivo de prueba; dentro del archivo, cada prueba usa correos únicos.
 */
export async function resetDatabase(): Promise<void> {
  const url = testDatabaseUrl();
  const prisma = createPrismaClient(url);
  try {
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await prisma.$executeRawUnsafe('CREATE SCHEMA public');
  } finally {
    await prisma.$disconnect();
  }
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: dbDir,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}

let counter = 0;
/** Correo único y permitido en pruebas (`nova-test.edu.co`). */
export function uniqueEmail(prefix = 'estudiante'): string {
  counter += 1;
  return `${prefix}.${Date.now().toString(36)}${counter}@nova-test.edu.co`;
}
