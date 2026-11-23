/**
 * Spec 004 · US1, US2 y US4 — Tarjetas: emitir, congelar, ver datos y administrar varias
 * (tasks.md T013, T020 y T030).
 */
import { Writable } from 'node:stream';

import { CardListSchema, CardSchema, isValidCardNumber } from '@nova/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLogger } from '../../src/lib/logger.js';
import { CARD_PASSWORD, createCardholder, issueCard, revealCard } from '../helpers/cards.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase } from '../helpers/test-db.js';
import { renewSession } from '../helpers/users.js';

const CARDS = '/api/v1/cards';
const logLines: string[] = [];
const sink = new Writable({
  write(chunk: Buffer, _encoding, done) {
    logLines.push(chunk.toString('utf8'));
    done();
  },
});
let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp({}, { logger: createLogger('trace', sink) });
});
afterAll(async () => {
  await t.close();
});

async function auditCount(userId: string, type: string): Promise<number> {
  return t.prisma.auditEvent.count({ where: { userId, type: type as never } });
}

describe('US1 · emitir (FR-001–FR-003, FR-007)', () => {
  it('emite una tarjeta activa con el nombre recortado, titular y vencimiento a 4 años', async () => {
    const user = await createCardholder(t, 'emite');
    const res = await user.agent.post(CARDS, { nickname: '  Compras en línea  ' });
    expect(res.status).toBe(201);
    const card = CardSchema.parse(res.body);
    const year = Number(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric' }).format(
        t.clock.now(),
      ),
    );
    expect(card).toMatchObject({
      nickname: 'Compras en línea',
      holderName: 'ANA PÉREZ GÓMEZ',
      status: 'active',
      expYear: year + 4,
    });

    const secrets = await revealCard(user, card.id);
    expect(secrets.number.endsWith(card.last4)).toBe(true);
    // Ninguna vista estándar contiene el número completo ni el CVV.
    for (const body of [res.body, (await user.agent.get(CARDS)).body]) {
      expect(JSON.stringify(body)).not.toContain(secrets.number);
    }
    expect(await auditCount(user.userId, 'CARD_ISSUED')).toBe(1);
    const event = await t.prisma.auditEvent.findFirstOrThrow({
      where: { userId: user.userId, type: 'CARD_ISSUED' },
    });
    expect(event.metadata).toEqual({ cardId: card.id, last4: card.last4 });
  });

  it('la base no guarda el número en claro ni el CVV', async () => {
    const user = await createCardholder(t, 'base');
    const card = await issueCard(user);
    const secrets = await revealCard(user, card.id);
    const row = await t.prisma.card.findUniqueOrThrow({ where: { id: card.id } });
    const dump = JSON.stringify(row, (_k, v: unknown) =>
      v instanceof Uint8Array ? Buffer.from(v).toString('latin1') : v,
    );
    expect(dump).not.toContain(secrets.number);
    expect(Object.values(row)).not.toContain(secrets.cvv);
    expect(row.panHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('nombre vacío o largo: 400', async () => {
    const user = await createCardholder(t, 'nombre');
    expect((await user.agent.post(CARDS, { nickname: '   ' })).status).toBe(400);
    expect((await user.agent.post(CARDS, { nickname: 'x'.repeat(31) })).status).toBe(400);
  });
});

describe('US1 · congelar y descongelar (FR-004)', () => {
  it('cambia el estado de inmediato y repetir no audita otra vez', async () => {
    const user = await createCardholder(t, 'congela');
    const card = await issueCard(user);
    const frozen = await user.agent.post(`${CARDS}/${card.id}/freeze`);
    expect(frozen.status).toBe(200);
    expect(frozen.body.status).toBe('frozen');
    expect((await user.agent.post(`${CARDS}/${card.id}/freeze`)).body.status).toBe('frozen');
    expect((await user.agent.post(`${CARDS}/${card.id}/unfreeze`)).body.status).toBe('active');
    expect((await user.agent.post(`${CARDS}/${card.id}/unfreeze`)).body.status).toBe('active');
    expect(await auditCount(user.userId, 'CARD_FROZEN')).toBe(1);
    expect(await auditCount(user.userId, 'CARD_UNFROZEN')).toBe(1);
  });

  it('la tarjeta de otro estudiante o un id inválido: 404 en todas las acciones (FR-010)', async () => {
    const owner = await createCardholder(t, 'duena');
    const other = await createCardholder(t, 'otra');
    const card = await issueCard(owner);
    for (const id of [card.id, 'no-es-uuid', '7b0e4c1a-3f2d-4e5b-9a8c-1d2e3f4a5b6c']) {
      for (const action of ['freeze', 'unfreeze', 'cancel']) {
        const res = await other.agent.post(`${CARDS}/${id}/${action}`);
        expect(res.status, `${action} ${id}`).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      }
      expect(
        (await other.agent.post(`${CARDS}/${id}/reveal`, { password: CARD_PASSWORD })).status,
      ).toBe(404);
      expect((await other.agent.get(`${CARDS}/${id}/payments`)).status).toBe(404);
    }
    expect((await other.agent.get(CARDS)).body).toEqual({ items: [] });
    // La tarjeta sigue intacta para su dueña.
    expect((await owner.agent.get(CARDS)).body.items[0].status).toBe('active');
  });
});

describe('US2 · ver los datos completos (FR-008, FR-009)', () => {
  it('con la contraseña: número Luhn que termina en last4, vencimiento y CVV estable, sin caché', async () => {
    const user = await createCardholder(t, 'revela');
    const card = await issueCard(user);
    const res = await user.agent.post(`${CARDS}/${card.id}/reveal`, { password: CARD_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.pragma).toBe('no-cache');
    expect(isValidCardNumber(res.body.number)).toBe(true);
    expect(res.body.number).toMatch(/^9\d{11}/);
    expect(res.body.number.slice(-4)).toBe(card.last4);
    expect(res.body).toMatchObject({ expMonth: card.expMonth, expYear: card.expYear });
    expect((await revealCard(user, card.id)).cvv).toBe(res.body.cvv);
    expect(await auditCount(user.userId, 'CARD_REVEALED')).toBe(2);
  });

  it('contraseña incorrecta: REAUTH_FAILED sin datos', async () => {
    const user = await createCardholder(t, 'mala');
    const card = await issueCard(user);
    const res = await user.agent.post(`${CARDS}/${card.id}/reveal`, { password: 'equivocada' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REAUTH_FAILED');
    expect(res.body.number).toBeUndefined();
    expect(await auditCount(user.userId, 'CARD_REVEALED')).toBe(0);
  });

  it('5 fallos bloquean, y el bloqueo se comparte con la reautenticación de las transferencias', async () => {
    const user = await createCardholder(t, 'bloqueo');
    const card = await issueCard(user);
    for (let i = 1; i <= 4; i += 1) {
      const res = await user.agent.post(`${CARDS}/${card.id}/reveal`, { password: `mala-${i}` });
      expect(res.body.error.code, `intento ${i}`).toBe('REAUTH_FAILED');
    }
    // El quinto fallo llega por el mismo servicio que usan las transferencias (spec 003).
    await expect(
      t.auth.reauth.verify(user.userId, 'mala-5', '00000000-0000-4000-8000-000000000000'),
    ).rejects.toMatchObject({ code: 'REAUTH_LOCKED' });
    const locked = await user.agent.post(`${CARDS}/${card.id}/reveal`, { password: CARD_PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('REAUTH_LOCKED');
    expect(locked.headers['retry-after']).toBeDefined();

    t.clock.advanceMinutes(16);
    await renewSession(t, user);
    expect(
      (await user.agent.post(`${CARDS}/${card.id}/reveal`, { password: CARD_PASSWORD })).status,
    ).toBe(200);
  });

  it('una tarjeta cancelada: 409 sin pedir la contraseña', async () => {
    const user = await createCardholder(t, 'revela-cancelada');
    const card = await issueCard(user);
    await user.agent.post(`${CARDS}/${card.id}/cancel`);
    const res = await user.agent.post(`${CARDS}/${card.id}/reveal`, { password: 'equivocada' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CARD_CANCELED');
  });

  it('los logs no contienen el número completo ni el CVV (SC-005)', async () => {
    const user = await createCardholder(t, 'logs');
    const card = await issueCard(user);
    const secrets = await revealCard(user, card.id);
    const logs = logLines.join('\n');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs).not.toContain(secrets.number);
    expect(logs).not.toContain(`"cvv":"${secrets.cvv}"`);
    expect(logs).not.toContain(CARD_PASSWORD);
  });
});

describe('US4 · varias tarjetas (FR-002, FR-005)', () => {
  it('3 vigentes como máximo; cancelar libera el cupo y la nueva tiene otro número', async () => {
    const user = await createCardholder(t, 'tres');
    // El reloj de prueba no avanza solo: se adelanta para que el orden de emisión sea estable.
    const cards = [];
    for (const nickname of ['Una', 'Dos', 'Tres']) {
      cards.push(await issueCard(user, nickname));
      t.clock.advanceSeconds(1);
    }
    const fourth = await user.agent.post(CARDS, { nickname: 'Cuatro' });
    expect(fourth.status).toBe(422);
    expect(fourth.body.error.code).toBe('CARD_LIMIT_REACHED');

    const first = cards[0];
    if (!first) throw new Error('sin tarjetas');
    const before = await revealCard(user, first.id);
    const canceled = await user.agent.post(`${CARDS}/${first.id}/cancel`);
    expect(canceled.body.status).toBe('canceled');
    const replacement = await issueCard(user, 'Reemplazo');
    expect((await revealCard(user, replacement.id)).number).not.toBe(before.number);

    const list = CardListSchema.parse((await user.agent.get(CARDS)).body).items;
    expect(list.map((c) => c.nickname)).toEqual(['Dos', 'Tres', 'Reemplazo', 'Una']);
    expect(list.at(-1)?.status).toBe('canceled');
    expect(await auditCount(user.userId, 'CARD_CANCELED')).toBe(1);
  });

  it('4 emisiones simultáneas: solo 3 se emiten', async () => {
    const user = await createCardholder(t, 'carrera');
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) => user.agent.post(CARDS, { nickname: `T${i}` })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.body?.error?.code === 'CARD_LIMIT_REACHED')).toHaveLength(1);
  });

  it('renombrar; una cancelada no admite ninguna acción (409)', async () => {
    const user = await createCardholder(t, 'renombra');
    const card = await issueCard(user);
    const renamed = await user.agent.patch(`${CARDS}/${card.id}`, { nickname: ' Suscripciones ' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.nickname).toBe('Suscripciones');

    await user.agent.post(`${CARDS}/${card.id}/cancel`);
    for (const action of ['freeze', 'unfreeze', 'cancel']) {
      const res = await user.agent.post(`${CARDS}/${card.id}/${action}`);
      expect(res.status, action).toBe(409);
      expect(res.body.error.code).toBe('CARD_CANCELED');
    }
    expect((await user.agent.patch(`${CARDS}/${card.id}`, { nickname: 'Otra' })).status).toBe(409);
  });

  it('la base impide modificar una tarjeta cancelada y borrar tarjetas', async () => {
    const user = await createCardholder(t, 'trigger');
    const card = await issueCard(user);
    await expect(t.prisma.card.delete({ where: { id: card.id } })).rejects.toThrow();
    await expect(
      t.prisma.card.update({ where: { id: card.id }, data: { last4: '0000' } }),
    ).rejects.toThrow(/datos de emisión/);
    await user.agent.post(`${CARDS}/${card.id}/cancel`);
    await expect(
      t.prisma.card.update({
        where: { id: card.id },
        data: { status: 'active', canceledAt: null },
      }),
    ).rejects.toThrow(/cancelada no puede cambiar/);
  });

  it('sin sesión: 401', async () => {
    expect((await request(t.app).get(CARDS)).status).toBe(401);
    expect((await request(t.app).post(CARDS).send({ nickname: 'x' })).status).toBe(401);
  });
});
