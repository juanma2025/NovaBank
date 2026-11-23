/**
 * Coherencia entre el contrato en código (@nova/shared) y los contratos de diseño de TODAS las
 * specs (specs/*\/contracts/*.json, research R10 de la spec 002). Si uno cambia sin el otro, falla.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CreateTopupRequestSchema,
  LedgerTransactionStatusSchema,
  MovementSchema,
  MovementTypeSchema,
} from './accounts.schemas.js';
import {
  CompleteRegistrationRequestSchema,
  LoginRequestSchema,
  StartPasswordResetRequestSchema,
  StartRegistrationRequestSchema,
  VerifyCodeRequestSchema,
} from './auth.schemas.js';
import {
  ERROR_CODES,
  ErrorDetailsSchema,
  PasswordRuleViolationSchema,
  SessionEndReasonSchema,
} from './errors.js';
import { DEMO_MERCHANTS, MerchantCategorySchema } from './cards.js';
import {
  CardNicknameRequestSchema,
  CardSchema,
  CreateCardPaymentRequestSchema,
} from './cards.schemas.js';
import { partialName } from './names.js';
import {
  CreateTransferRequestSchema,
  RecipientPreviewSchema,
  SetAliasRequestSchema,
} from './transfers.schemas.js';

interface SchemaObject {
  $ref?: string;
  required?: string[];
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
const transfers = contractFile('transfers.openapi.json');
const cards = contractFile('cards.openapi.json');

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

  it('Movement es igual en los contratos de la 002 y la 003 y coincide con el esquema', () => {
    expect(schema(transfers, 'Movement')).toEqual(schema(accounts, 'Movement'));
    const movement = schema(accounts, 'Movement');
    expect(MovementTypeSchema.options).toEqual(movement.properties?.type?.enum);
    expect(Object.keys(MovementSchema.shape).sort()).toEqual([...(movement.required ?? [])].sort());
  });

  it('details incluye todos los campos de los contratos', () => {
    const fields = new Set(
      contracts.flatMap((c) =>
        Object.keys(
          schema(c, 'ErrorResponse').properties?.error?.properties?.details?.properties ?? {},
        ),
      ),
    );
    expect([...fields].filter((f) => !(f in ErrorDetailsSchema.shape))).toEqual([]);
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

describe('contratos: ejemplos de la 003', () => {
  it('SetAliasRequest con el ejemplo de Alias', () => {
    const alias = schema(transfers, 'Alias').examples?.[0];
    expect(SetAliasRequestSchema.safeParse({ alias }).success).toBe(true);
  });

  it('RecipientPreview: el ejemplo de displayName sale de partialName', () => {
    const props = schema(transfers, 'RecipientPreview').properties;
    expect(partialName('Ana Pérez Gómez')).toBe(props?.displayName?.examples?.[0]);
    expect(
      RecipientPreviewSchema.safeParse({
        recipientId: '7b0e4c1a-3f2d-4e5b-9a8c-1d2e3f4a5b6c',
        displayName: props?.displayName?.examples?.[0],
        maskedEmail: props?.maskedEmail?.examples?.[0],
      }).success,
    ).toBe(true);
  });

  it('CreateTransferRequest con el ejemplo de MoneyAmount', () => {
    const amount = schema(transfers, 'MoneyAmount').examples?.[0];
    expect(
      CreateTransferRequestSchema.safeParse({
        recipientId: '7b0e4c1a-3f2d-4e5b-9a8c-1d2e3f4a5b6c',
        amount,
      }).success,
    ).toBe(true);
  });
});

describe('contratos: tarjetas y tienda de la 004', () => {
  it('Movement de la 004 es igual al de la 002', () => {
    expect(schema(cards, 'Movement')).toEqual(schema(accounts, 'Movement'));
  });

  it('los comercios y las categorías coinciden con el contrato', () => {
    expect(DEMO_MERCHANTS.map((m) => m.id)).toEqual(schema(cards, 'MerchantId').enum);
    expect(MerchantCategorySchema.options).toEqual(schema(cards, 'MerchantCategory').enum);
  });

  it('Card tiene los campos del contrato', () => {
    expect(Object.keys(CardSchema.shape).sort()).toEqual(
      [...(schema(cards, 'Card').required ?? [])].sort(),
    );
  });

  it('los ejemplos del contrato son válidos', () => {
    const card = schema(cards, 'Card').properties;
    expect(
      CardNicknameRequestSchema.safeParse({ nickname: card?.nickname?.examples?.[0] }).success,
    ).toBe(true);
    const req = schema(cards, 'CreateCardPaymentRequest').properties;
    expect(
      CreateCardPaymentRequestSchema.safeParse({
        merchantId: DEMO_MERCHANTS[0].id,
        amount: schema(cards, 'MoneyAmount').examples?.[0],
        cardNumber: req?.cardNumber?.examples?.[0],
        expiry: req?.expiry?.examples?.[0],
        cvv: req?.cvv?.examples?.[0],
      }).success,
    ).toBe(true);
  });
});
