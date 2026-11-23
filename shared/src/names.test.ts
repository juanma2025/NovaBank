import { describe, expect, it } from 'vitest';

import { partialName } from './names.js';

describe('partialName', () => {
  it('deja el primer nombre y las iniciales del resto', () => {
    expect(partialName('Ana Pérez Gómez')).toBe('Ana P. G.');
    expect(partialName('Juan Carlos')).toBe('Juan C.');
  });

  it('un solo nombre queda igual', () => {
    expect(partialName('Lu')).toBe('Lu');
  });

  it('ignora espacios repetidos y respeta tildes, eñes y guiones', () => {
    expect(partialName('  María   Ángela  Núñez-Ríos ')).toBe('María Á. N.');
    expect(partialName('josé ñañez')).toBe('josé Ñ.');
  });

  it('un nombre vacío da texto vacío', () => {
    expect(partialName('   ')).toBe('');
  });
});
