/** Plantillas de correo (spec 006, tasks.md T008: alerta de presupuesto). */
import { describe, expect, it } from 'vitest';

import { renderTemplate } from '../../src/lib/mail/templates/index.js';

const data = { categoryName: 'Comida', percent: 82, spent: '$ 165.000', limit: '$ 200.000' };

describe('budget_alert', () => {
  it('aviso del 80 %: asunto, montos y que no bloquea', () => {
    const email = renderTemplate('budget_alert', { ...data, kind: 'warning' });
    expect(email.subject).toBe('Te estás acercando a tu presupuesto de Comida');
    expect(email.text).toContain('Llevas $ 165.000 de $ 200.000 en Comida este mes (82 %).');
    expect(email.text).toContain('no se bloquean');
    expect(email.html).toContain('Comida');
  });

  it('aviso al superar el tope', () => {
    const email = renderTemplate('budget_alert', { ...data, percent: 105, kind: 'exceeded' });
    expect(email.subject).toBe('Superaste tu presupuesto de Comida');
  });

  it('falla si falta un dato', () => {
    expect(() => renderTemplate('budget_alert', { kind: 'warning' })).toThrow(/categoryName/);
  });
});

describe('gastos compartidos (spec 007)', () => {
  const split = { creatorName: 'Ana P. G.', title: 'Cena', amount: '$ 30.000' };

  it('invitación y recordatorio dicen quién, qué y cuánto', () => {
    const invitation = renderTemplate('split_invitation', split);
    expect(invitation.subject).toBe('Ana P. G. dividió «Cena» contigo');
    expect(invitation.text).toContain('Tu parte es de $ 30.000');
    const reminder = renderTemplate('split_reminder', split);
    expect(reminder.subject).toBe('Recordatorio: tu parte de «Cena»');
    expect(reminder.text).toContain('$ 30.000');
  });

  it('pago recibido', () => {
    const paid = renderTemplate('split_paid', {
      participantName: 'Juan C. R.',
      title: 'Cena',
      amount: '$ 30.000',
    });
    expect(paid.subject).toBe('Juan C. R. pagó su parte de «Cena»');
    expect(paid.text).toContain('te transfirió $ 30.000');
  });
});
