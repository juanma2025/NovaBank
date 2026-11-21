import { describe, expect, it } from 'vitest';

import {
  CompleteRegistrationRequestSchema,
  FullNameSchema,
  LoginRequestSchema,
  SessionResponseSchema,
  StartRegistrationRequestSchema,
  VerificationCodeSchema,
  VerificationStateSchema,
  VerifyCodeRequestSchema,
} from './auth.schemas.js';
import { PRIVACY_POLICY_VERSION } from './constants.js';

describe('FullNameSchema (FR-012)', () => {
  it('acepta tildes, ñ, guion y apóstrofo', () => {
    for (const name of ['Ana Pérez', 'José Muñoz', 'María-José Peña', "D'Angelo Ríos", 'Lu']) {
      expect(FullNameSchema.safeParse(name).success, name).toBe(true);
    }
  });

  it('rechaza números, símbolos y bordes no alfabéticos', () => {
    for (const name of ['Ana 2', 'Ana_Pérez', 'Ana!', '-Ana', "Ana'", ' ', 'A']) {
      expect(FullNameSchema.safeParse(name).success, name).toBe(false);
    }
  });

  it('recorta espacios externos y respeta el máximo de 100', () => {
    expect(FullNameSchema.parse('  Ana Pérez  ')).toBe('Ana Pérez');
    expect(FullNameSchema.safeParse('a'.repeat(100)).success).toBe(true);
    expect(FullNameSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });
});

describe('VerificationCodeSchema (FR-003)', () => {
  it('acepta exactamente 6 dígitos', () => {
    expect(VerificationCodeSchema.safeParse('012345').success).toBe(true);
    for (const code of ['12345', '1234567', '12a456', ' 123456', '١٢٣٤٥٦']) {
      expect(VerificationCodeSchema.safeParse(code).success, code).toBe(false);
    }
  });
});

describe('requests', () => {
  it('StartRegistrationRequest normaliza el correo y rechaza campos extra', () => {
    const parsed = StartRegistrationRequestSchema.parse({
      email: ' Ana.Perez@UCC.edu.co',
      acceptedPolicyVersion: PRIVACY_POLICY_VERSION,
    });
    expect(parsed.email).toBe('ana.perez@ucc.edu.co');
    expect(StartRegistrationRequestSchema.safeParse({ ...parsed, admin: true }).success).toBe(
      false,
    );
  });

  it('CompleteRegistrationRequest exige nombre y contraseña válidos', () => {
    expect(
      CompleteRegistrationRequestSchema.safeParse({
        fullName: 'Ana Pérez',
        password: 'una clave larga',
      }).success,
    ).toBe(true);
    expect(
      CompleteRegistrationRequestSchema.safeParse({ fullName: 'Ana Pérez', password: 'corta' })
        .success,
    ).toBe(false);
  });

  it('LoginRequest no aplica reglas de fortaleza, solo longitud', () => {
    expect(LoginRequestSchema.safeParse({ email: 'ana@ucc.edu.co', password: 'x' }).success).toBe(
      true,
    );
    expect(LoginRequestSchema.safeParse({ email: 'ana@ucc.edu.co', password: '' }).success).toBe(
      false,
    );
  });

  it('VerifyCodeRequest rechaza campos extra', () => {
    expect(VerifyCodeRequestSchema.safeParse({ code: '123456', extra: 1 }).success).toBe(false);
  });
});

describe('responses', () => {
  it('VerificationState acepta completeBy nulo mientras step = code', () => {
    expect(
      VerificationStateSchema.safeParse({
        purpose: 'registration',
        step: 'code',
        maskedEmail: 'an***@ucc.edu.co',
        codeExpiresAt: '2026-11-20T15:15:00Z',
        resendAvailableAt: '2026-11-20T15:01:00Z',
        attemptsLeft: 5,
        completeBy: null,
      }).success,
    ).toBe(true);
  });

  it('SessionResponse valida usuario y sesión', () => {
    expect(
      SessionResponseSchema.safeParse({
        user: {
          id: '7c3e1f0a-2b4d-4c6e-8f10-1a2b3c4d5e6f',
          email: 'ana@ucc.edu.co',
          fullName: 'Ana Pérez',
        },
        session: {
          idleTimeoutSeconds: 900,
          idleWarningSeconds: 60,
          lastActivityAt: '2026-11-20T15:00:00Z',
          absoluteExpiresAt: '2026-11-21T03:00:00Z',
        },
      }).success,
    ).toBe(true);
  });
});
