/**
 * Prueba de contrato (research R12, tasks.md T035): cada operación del documento generado en
 * GET /api/v1/openapi.json debe coincidir con specs/001-auth-onboarding/contracts/auth.openapi.json
 * en método, ruta, códigos de estado y forma de los cuerpos de request y response.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../helpers/test-app.js';

interface Schema {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
}
interface ResponseObject {
  $ref?: string;
  content?: Record<string, { schema: Schema }>;
}
interface Operation {
  operationId?: string;
  requestBody?: { content: Record<string, { schema: Schema }> };
  responses: Record<string, ResponseObject>;
}
interface Doc {
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema>; responses?: Record<string, ResponseObject> };
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const contractFile = fileURLToPath(
  new URL('../../../specs/001-auth-onboarding/contracts/auth.openapi.json', import.meta.url),
);
const contract = JSON.parse(readFileSync(contractFile, 'utf8')) as Doc;

let t: TestApp;
let generated: Doc;

beforeAll(async () => {
  t = createTestApp();
  generated = (await request(t.app).get('/api/v1/openapi.json')).body as Doc;
});
afterAll(async () => {
  await t.close();
});

function resolve(doc: Doc, schema: Schema | undefined): Schema | undefined {
  if (!schema?.$ref) return schema;
  const name = schema.$ref.split('/').at(-1) ?? '';
  return resolve(doc, doc.components?.schemas?.[name]);
}

/** Resuelve `$ref: '#/components/responses/X'` del contrato. */
function resolveResponse(
  doc: Doc,
  response: ResponseObject | undefined,
): ResponseObject | undefined {
  if (!response?.$ref) return response;
  const name = response.$ref.split('/').at(-1) ?? '';
  return resolveResponse(doc, doc.components?.responses?.[name]);
}

/** Forma comparable: propiedades y requeridos de primer nivel. */
function shape(doc: Doc, schema: Schema | undefined) {
  const resolved = resolve(doc, schema);
  return {
    properties: Object.keys(resolved?.properties ?? {}).sort(),
    required: [...(resolved?.required ?? [])].sort(),
  };
}

function operations(doc: Doc) {
  const list: { key: string; path: string; method: string; op: Operation }[] = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of METHODS) {
      const op = item[method];
      if (op) list.push({ key: `${method.toUpperCase()} ${path}`, path, method, op });
    }
  }
  return list;
}

describe('contrato OpenAPI de la spec 001', () => {
  it('el documento generado tiene operaciones', () => {
    expect(operations(generated).length).toBeGreaterThan(0);
  });

  it('están todas las operaciones del contrato: ninguna falta ni sobra (T080)', () => {
    // GET /openapi.json sirve el propio documento y no forma parte del contrato.
    const generatedKeys = operations(generated)
      .map((o) => o.key)
      .filter((key) => key !== 'GET /openapi.json')
      .sort();
    const contractKeys = operations(contract)
      .map((o) => o.key)
      .sort();
    expect(contractKeys).toHaveLength(12);
    expect(generatedKeys).toEqual(contractKeys);
  });

  it('cada operación generada existe en el contrato con el mismo operationId', () => {
    for (const { key, path, method, op } of operations(generated)) {
      const expected = contract.paths[path]?.[method];
      expect(expected, `${key} no está en el contrato`).toBeDefined();
      expect(op.operationId, key).toBe(expected?.operationId);
    }
  });

  it('los códigos de estado coinciden', () => {
    for (const { key, path, method, op } of operations(generated)) {
      const expected = contract.paths[path]?.[method];
      expect(Object.keys(op.responses).sort(), key).toEqual(
        Object.keys(expected?.responses ?? {}).sort(),
      );
    }
  });

  it('los cuerpos de request y de las respuestas JSON tienen la misma forma', () => {
    for (const { key, path, method, op } of operations(generated)) {
      const expected = contract.paths[path]?.[method];
      const reqSchema = op.requestBody?.content['application/json']?.schema;
      const expectedReq = expected?.requestBody?.content['application/json']?.schema;
      expect(shape(generated, reqSchema), `${key} request`).toEqual(shape(contract, expectedReq));
      for (const [status, response] of Object.entries(op.responses)) {
        const schema = response.content?.['application/json']?.schema;
        const expectedSchema = resolveResponse(contract, expected?.responses[status])?.content?.[
          'application/json'
        ]?.schema;
        expect(shape(generated, schema), `${key} ${status}`).toEqual(
          shape(contract, expectedSchema),
        );
      }
    }
  });
});
