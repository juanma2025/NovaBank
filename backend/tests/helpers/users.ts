import { hashPassword } from '../../src/modules/auth/password-policy.js';
import type { TestAgent } from './agent.js';
import type { TestApp } from './test-app.js';
import { uniqueEmail } from './test-db.js';

export const IDEMPOTENCY = 'Idempotency-Key';

export interface TestUser {
  userId: string;
  email: string;
  agent: TestAgent;
}

/**
 * Crea un estudiante y devuelve un agente con sesión iniciada (pruebas de las specs 002 y 003).
 * Con `password`, guarda su hash real (para la reautenticación de la 003).
 */
export async function createUserWithSession(
  t: TestApp,
  prefix = 'estudiante',
  options: { fullName?: string; password?: string } = {},
): Promise<TestUser> {
  const email = uniqueEmail(prefix);
  const user = await t.prisma.user.create({
    data: {
      email,
      fullName: options.fullName ?? 'Ana Pérez',
      passwordHash: options.password ? await hashPassword(options.password) : 'x',
      passwordChangedAt: t.clock.now(),
    },
  });
  const issued = await t.auth.sessions.create(t.prisma, user.id);
  const agent = t.agent();
  agent.cookies.set('nova_at', issued.accessToken);
  return { userId: user.id, email, agent };
}

/** Nueva sesión para el mismo estudiante (por ejemplo, tras adelantar el reloj un día). */
export async function renewSession(t: TestApp, user: TestUser): Promise<void> {
  const fresh = await t.auth.sessions.create(t.prisma, user.userId);
  user.agent.cookies.set('nova_at', fresh.accessToken);
}

let keyCounter = 0;
/** Clave de idempotencia única para una prueba. */
export function newKey(): string {
  keyCounter += 1;
  return `prueba-${Date.now().toString(36)}-${keyCounter}`;
}
