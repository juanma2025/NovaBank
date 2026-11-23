import type { TestAgent } from './agent.js';
import type { TestApp } from './test-app.js';
import { uniqueEmail } from './test-db.js';

export const IDEMPOTENCY = 'Idempotency-Key';

/** Crea un estudiante y devuelve un agente con sesión iniciada (para las pruebas de la 002). */
export async function createUserWithSession(
  t: TestApp,
  prefix = 'estudiante',
): Promise<{ userId: string; email: string; agent: TestAgent }> {
  const email = uniqueEmail(prefix);
  const user = await t.prisma.user.create({
    data: { email, fullName: 'Ana Pérez', passwordHash: 'x', passwordChangedAt: t.clock.now() },
  });
  const issued = await t.auth.sessions.create(t.prisma, user.id);
  const agent = t.agent();
  agent.cookies.set('nova_at', issued.accessToken);
  return { userId: user.id, email, agent };
}

let keyCounter = 0;
/** Clave de idempotencia única para una prueba. */
export function newKey(): string {
  keyCounter += 1;
  return `prueba-${Date.now().toString(36)}-${keyCounter}`;
}
