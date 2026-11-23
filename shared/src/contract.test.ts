/**
 * Coherencia entre el contrato en código (@nova/shared) y los contratos de diseño de TODAS las
 * specs (specs/*\/contracts/*.json, research R10 de la spec 002). Si uno cambia sin el otro, falla.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CreateTopupRequestSchema, LedgerTransactionStatusSchema } from './accounts.schemas.js';
import {
  CompleteRegistrationRequestSchema,
  LoginRequestSchema,
  StartPasswordResetRequestSchema,
  StartRegistrationRequestSchema,
  VerifyCodeRequestSchema,
} from './auth.schemas.js';
import { ERROR_CODES, PasswordRuleViolationSchema, SessionEndReasonSchema } from './errors.js';

interface SchemaObject {
  $ref?: string;
  enum?: string[];
  examples?: unknown[];
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
}
interface Contract {
  file: string;
  components: { schemas: Record<string, SchemaObject> };
}

const specsDir = fileURLToPath(new URL('../../specs', import.meta.url));
const contracts: Contract[] = readdirSync(specsDir)
  .map((spec) => join(specsDir, spec, 'contracts'))
  .filter((dir) => existsSync(dir))
  .flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({
        file: f,
        ...(JSON.parse(readFileSync(join(dir, f), 'utf8')) as Omit<Contract, 'file'>),
      })),
  );

function contractFile(name: string): Contract {
  const found = contracts.find((c) => c.file === name);
  if (!found) throw new Error(`No existe el contrato ${name}`);
  return found;
}

function schema(contract: Contract, name: string): SchemaObject {
  const found = contract.components.schemas[name];
  if (!found) throw new Error(`${contract.file} no define ${name}`);
  return found;
}

const auth = contractFile('auth.openapi.json');
const accounts = contractFile('accounts.openapi.json');

describe('contratos: códigos y enums', () => {
  it('hay al menos un contrato por spec', () => {
    expect(contracts.length).toBeGreaterThanOrEqual(2);
  });

  it('ERROR_CODES es exactamente la unión de los ErrorCode de todos los contratos', () => {
    const union = new Set(contracts.flatMap((c) => schema(c, 'ErrorCode').enum ?? []));
    expect([...ERROR_CODES].sort()).toEqual([...union].sort());
  });

  it('details.reasons y details.reason coinciden con el contrato de la 001', () => {
    const details = schema(auth, 'ErrorResponse').properties?.error?.properties?.details
      ?.properties;
    expect(PasswordRuleViolationSchema.options).toEqual(details?.reasons?.items?.enum);
    expect(SessionEndReasonSchema.options).toEqual(details?.reason?.enum);
  });

  it('los estados de un movimiento coinciden con el contrato de la 002', () => {
    expect(LedgerTransactionStatusSchema.options).toEqual(
      schema(accounts, 'Movement').properties?.status?.enum,
    );
  });
});

describe('contratos: los ejemplos son válidos', () => {
  const email = schema(auth, 'InstitutionalEmail').examples?.[0];
  const policyVersion = schema(auth, 'StartRegistrationRequest').properties?.acceptedPolicyVersion
    ?.examples?.[0];

  it('001: StartRegistrationRequest', () => {
    expect(
      StartRegistrationRequestSchema.safeParse({ email, acceptedPolicyVersion: policyVersion })
        .success,
    ).toBe(true);
  });

  it('001: StartPasswordResetRequest y LoginRequest', () => {
    expect(StartPasswordResetRequestSchema.safeParse({ email }).success).toBe(true);
    expect(LoginRequestSchema.safeParse({ email, password: 'cualquiera' }).success).toBe(true);
  });

  it('001: VerifyCodeRequest y CompleteRegistrationRequest', () => {
    expect(VerifyCodeRequestSchema.safeParse({ code: '000000' }).success).toBe(true);
    expect(
      CompleteRegistrationRequestSchema.safeParse({
        fullName: 'Ana Pérez',
        password: 'una clave larga',
      }).success,
    ).toBe(true);
  });

  it('002: CreateTopupRequest con el ejemplo de MoneyAmount', () => {
    const amount = schema(accounts, 'MoneyAmount').examples?.[0];
    expect(CreateTopupRequestSchema.safeParse({ amount }).success).toBe(true);
  });
});
