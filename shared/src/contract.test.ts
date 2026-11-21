/**
 * Coherencia entre el contrato en código (@nova/shared) y el contrato de diseño
 * (specs/001-auth-onboarding/contracts/auth.openapi.json). Si uno cambia sin el otro, falla.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CompleteRegistrationRequestSchema,
  LoginRequestSchema,
  StartPasswordResetRequestSchema,
  StartRegistrationRequestSchema,
  VerifyCodeRequestSchema,
} from './auth.schemas.js';
import { ERROR_CODES, PasswordRuleViolationSchema, SessionEndReasonSchema } from './errors.js';

interface SchemaObject {
  enum?: string[];
  examples?: unknown[];
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
}

const contractPath = fileURLToPath(
  new URL('../../specs/001-auth-onboarding/contracts/auth.openapi.json', import.meta.url),
);
const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
  components: { schemas: Record<string, SchemaObject> };
};
const schemas = contract.components.schemas;

function schema(name: string): SchemaObject {
  const found = schemas[name];
  if (!found) throw new Error(`El contrato no define ${name}`);
  return found;
}

describe('contrato: códigos y enums', () => {
  it('ERROR_CODES coincide con components.schemas.ErrorCode', () => {
    expect([...ERROR_CODES]).toEqual(schema('ErrorCode').enum);
  });

  it('details.reasons y details.reason coinciden con el contrato', () => {
    const details = schema('ErrorResponse').properties?.error?.properties?.details?.properties;
    expect(PasswordRuleViolationSchema.options).toEqual(details?.reasons?.items?.enum);
    expect(SessionEndReasonSchema.options).toEqual(details?.reason?.enum);
  });
});

describe('contrato: los ejemplos son válidos', () => {
  const email = schema('InstitutionalEmail').examples?.[0];
  const policyVersion = schema('StartRegistrationRequest').properties?.acceptedPolicyVersion
    ?.examples?.[0];

  it('StartRegistrationRequest', () => {
    expect(
      StartRegistrationRequestSchema.safeParse({ email, acceptedPolicyVersion: policyVersion })
        .success,
    ).toBe(true);
  });

  it('StartPasswordResetRequest y LoginRequest', () => {
    expect(StartPasswordResetRequestSchema.safeParse({ email }).success).toBe(true);
    expect(LoginRequestSchema.safeParse({ email, password: 'cualquiera' }).success).toBe(true);
  });

  it('VerifyCodeRequest y CompleteRegistrationRequest', () => {
    expect(VerifyCodeRequestSchema.safeParse({ code: '000000' }).success).toBe(true);
    expect(
      CompleteRegistrationRequestSchema.safeParse({
        fullName: 'Ana Pérez',
        password: 'una clave larga',
      }).success,
    ).toBe(true);
  });
});
