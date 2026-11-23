/** Spec 006 · bus de eventos en proceso (tasks.md T007; research R2). */
import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createEventBus } from '../../src/lib/events.js';
import { createLogger } from '../../src/lib/logger.js';

function capture() {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString('utf8'));
      done();
    },
  });
  return { lines, logger: createLogger('error', sink) };
}

describe('createEventBus', () => {
  it('entrega el evento a todos los suscriptores, en orden, y espera a los asíncronos', async () => {
    const { logger } = capture();
    const bus = createEventBus(logger);
    const calls: string[] = [];
    bus.on('spending.recorded', async ({ userId }) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      calls.push(`a:${userId}`);
    });
    bus.on('spending.recorded', ({ userId }) => {
      calls.push(`b:${userId}`);
    });
    await bus.emit('spending.recorded', { userId: 'u1' });
    expect(calls).toEqual(['a:u1', 'b:u1']);
  });

  it('un suscriptor que falla no interrumpe a los demás ni lanza, y queda en el log', async () => {
    const { lines, logger } = capture();
    const bus = createEventBus(logger);
    const calls: string[] = [];
    bus.on('spending.recorded', () => {
      throw new Error('falla simulada');
    });
    bus.on('spending.recorded', () => {
      calls.push('segundo');
    });
    await expect(bus.emit('spending.recorded', { userId: 'u1' })).resolves.toBeUndefined();
    expect(calls).toEqual(['segundo']);
    expect(lines.join('')).toContain('falla simulada');
  });

  it('sin suscriptores no hace nada', async () => {
    await expect(
      createEventBus(capture().logger).emit('spending.recorded', { userId: 'u1' }),
    ).resolves.toBeUndefined();
  });
});
