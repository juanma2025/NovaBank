import { describe, expect, it } from 'vitest';

import { splitEvenly } from './splits.js';

describe('splitEvenly', () => {
  it('divide exacto cuando se puede', () => {
    expect(splitEvenly(90_000, 2)).toEqual({ creatorShare: 30_000, share: 30_000 });
  });

  it('el sobrante de pesos lo asume quien crea', () => {
    expect(splitEvenly(10_000, 2)).toEqual({ creatorShare: 3334, share: 3333 });
    expect(splitEvenly(10_001, 1)).toEqual({ creatorShare: 5001, share: 5000 });
  });

  it('con 10 participantes la suma siempre da el total', () => {
    const { creatorShare, share } = splitEvenly(123_457, 10);
    expect(share).toBe(11_223);
    expect(creatorShare + share * 10).toBe(123_457);
  });

  it('rechaza entradas inválidas', () => {
    expect(() => splitEvenly(1000, 0)).toThrow();
    expect(() => splitEvenly(10.5, 2)).toThrow();
  });
});
