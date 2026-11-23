import { describe, expect, it } from 'vitest';

import { addYearsToIsoDate, bogotaToday, goalProgress, isValidIsoDate } from './savings.js';

const TODAY = '2026-11-23';

describe('goalProgress', () => {
  it('0 % sin saldo y 8 % redondeado hacia abajo', () => {
    expect(goalProgress({ balance: 0, targetAmount: 600_000, targetDate: null }, TODAY)).toEqual({
      percent: 0,
      remaining: 600_000,
      completed: false,
      overdue: false,
      suggestedMonthly: null,
    });
    expect(
      goalProgress({ balance: 50_000, targetAmount: 600_000, targetDate: null }, TODAY).percent,
    ).toBe(8);
  });

  it('cumplida con saldo igual o mayor al objetivo; la barra no pasa de 100', () => {
    for (const balance of [600_000, 900_000]) {
      expect(
        goalProgress({ balance, targetAmount: 600_000, targetDate: '2026-12-01' }, TODAY),
      ).toEqual({
        percent: 100,
        remaining: 0,
        completed: true,
        overdue: false,
        suggestedMonthly: null,
      });
    }
  });

  it('ahorro sugerido: lo que falta entre los meses completos que quedan', () => {
    // Del 23 de noviembre al 15 de junio quedan 6 meses completos.
    const progress = goalProgress(
      { balance: 50_000, targetAmount: 600_000, targetDate: '2027-06-15' },
      TODAY,
    );
    expect(progress.suggestedMonthly).toBe(Math.ceil(550_000 / 6));
  });

  it('con la fecha este mismo mes, divide entre 1', () => {
    expect(
      goalProgress({ balance: 0, targetAmount: 10_000, targetDate: '2026-11-30' }, TODAY)
        .suggestedMonthly,
    ).toBe(10_000);
    expect(
      goalProgress({ balance: 0, targetAmount: 10_000, targetDate: TODAY }, TODAY).suggestedMonthly,
    ).toBe(10_000);
  });

  it('fecha vencida sin cumplir: overdue y sin sugerencia', () => {
    expect(
      goalProgress({ balance: 1000, targetAmount: 10_000, targetDate: '2026-11-22' }, TODAY),
    ).toMatchObject({ overdue: true, suggestedMonthly: null, completed: false });
  });
});

describe('fechas', () => {
  it('isValidIsoDate exige AAAA-MM-DD que exista', () => {
    expect(isValidIsoDate('2027-06-15')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    for (const value of ['2026-02-30', '2027-02-29', '2026-13-01', '15/06/2027', '2027-6-15']) {
      expect(isValidIsoDate(value), value).toBe(false);
    }
  });

  it('bogotaToday usa la hora de Colombia', () => {
    // 03:00 UTC del 24 es todavía el 23 en Bogotá (UTC−5).
    expect(bogotaToday(new Date('2026-11-24T03:00:00Z'))).toBe('2026-11-23');
    expect(bogotaToday(new Date('2026-11-24T05:00:00Z'))).toBe('2026-11-24');
  });

  it('addYearsToIsoDate suma años y ajusta el 29 de febrero', () => {
    expect(addYearsToIsoDate('2026-11-23', 10)).toBe('2036-11-23');
    expect(addYearsToIsoDate('2028-02-29', 1)).toBe('2029-02-28');
  });
});
