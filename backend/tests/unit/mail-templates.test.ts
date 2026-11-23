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
