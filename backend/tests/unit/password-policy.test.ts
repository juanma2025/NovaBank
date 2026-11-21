import { describe, expect, it } from 'vitest';

import {
  checkPassword,
  hashPassword,
  verifyPassword,
} from '../../src/modules/auth/password-policy.js';

const EMAIL = 'ana.perez@nova-test.edu.co';

describe('política de contraseñas (FR-010, research R10)', () => {
  it('acepta una contraseña válida y poco común', () => {
    expect(checkPassword('Arepa con queso 2026!', EMAIL)).toEqual([]);
  });

  it('rechaza contraseñas de la lista común sin distinguir mayúsculas', () => {
    expect(checkPassword('qwertyuiop', EMAIL)).toEqual(['common']);
    expect(checkPassword('QWERTYUIOP', EMAIL)).toEqual(['common']);
    expect(checkPassword('1234567890', EMAIL)).toEqual(['common']);
  });

  it('combina las reglas compartidas con la lista común', () => {
    expect(checkPassword('corta', EMAIL)).toEqual(['too_short']);
    expect(checkPassword('ana.perez-2026-x', EMAIL)).toEqual(['contains_email']);
  });

  it('ignora las líneas de comentario del archivo', () => {
    expect(
      checkPassword('# contraseñas comunes de 10 a 128 caracteres (research r10).', EMAIL),
    ).not.toContain('common');
  });

  it('el hash es Argon2id y se verifica', async () => {
    const hash = await hashPassword('Arepa con queso 2026!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'Arepa con queso 2026!')).toBe(true);
    expect(await verifyPassword(hash, 'otra cosa distinta')).toBe(false);
  });
});
