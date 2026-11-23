/**
 * Prueba de contrato (spec 001 R12, spec 002 R10): cada operación del documento generado en
 * GET /api/v1/openapi.json debe coincidir con la del contrato que la define
 * (specs/*\/contracts/*.json) en ruta, operationId, códigos de estado y forma de los cuerpos;
 * y deben estar todas las operaciones de todos los contratos.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../helpers/test-app.js';

interface Schema {
  $ref?: string;
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
  file?: string;
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema>; responses?: Record<string, ResponseObject> };
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const specsDir = fileURLToPath(new URL('../../../specs', import.meta.url));
const contracts: Doc[] = readdirSync(specsDir)
  .map((spec) => join(specsDir, spec, 'contracts'))
  .filter((dir) => existsSync(dir))
  .flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ file: f, ...(JSON.parse(readFileSync(join(dir, f), 'utf8')) as Doc) })),
  );

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
  return resolve(doc, doc.components?.schemas?.[schema.$ref.split('/').at(-1) ?? '']);
}

function resolveResponse(doc: Doc, r: ResponseObject | undefined): ResponseObject | undefined {
  if (!r?.$ref) return r;
  return resolveResponse(doc, doc.components?.responses?.[r.$ref.split('/').at(-1) ?? '']);
}

function shape(doc: Doc, schema: Schema | undefined) {
  const resolved = resolve(doc, schema);
  return {
    properties: Object.keys(resolved?.properties ?? {}).sort(),
    required: [...(resolved?.required ?? [])].sort(),
  };
}

function operations(doc: Doc) {
  const list: { key: string; path: string; method: string; op: Operation; doc: Doc }[] = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of METHODS) {
      const op = item[method];
      if (op) list.push({ key: `${method.toUpperCase()} ${path}`, path, method, op, doc });
    }
  }
  return list;
}

const contractOps = new Map(contracts.flatMap((c) => operations(c)).map((o) => [o.key, o]));

describe('contratos OpenAPI de todas las specs', () => {
  it('hay contratos de varias specs y ninguna operación está definida dos veces', () => {
    expect(contracts.length).toBeGreaterThanOrEqual(2);
    const all = contracts.flatMap((c) => operations(c).map((o) => o.key));
    expect(new Set(all).size).toBe(all.length);
  });

  it('están todas las operaciones de los contratos: ninguna falta ni sobra', () => {
    // GET /openapi.json sirve el propio documento y no forma parte de ningún contrato.
    const generatedKeys = operations(generated)
      .map((o) => o.key)
      .filter((k) => k !== 'GET /openapi.json')
      .sort();
    expect(generatedKeys).toEqual([...contractOps.keys()].sort());
  });

  it('cada operación coincide en operationId y códigos de estado', () => {
    for (const { key, op } of operations(generated)) {
      const expected = contractOps.get(key);
      expect(expected, `${key} no está en ningún contrato`).toBeDefined();
      expect(op.operationId, key).toBe(expected?.op.operationId);
      expect(Object.keys(op.responses).sort(), key).toEqual(
        Object.keys(expected?.op.responses ?? {}).sort(),
      );
    }
  });

  it('los cuerpos de request y de las respuestas JSON tienen la misma forma', () => {
    for (const { key, op } of operations(generated)) {
      const expected = contractOps.get(key);
      if (!expected) continue;
      const reqSchema = op.requestBody?.content['application/json']?.schema;
      const expectedReq = expected.op.requestBody?.content['application/json']?.schema;
      expect(shape(generated, reqSchema), `${key} request`).toEqual(
        shape(expected.doc, expectedReq),
      );
      for (const [status, response] of Object.entries(op.responses)) {
        const schema = response.content?.['application/json']?.schema;
        const expectedSchema = resolveResponse(expected.doc, expected.op.responses[status])
          ?.content?.['application/json']?.schema;
        expect(shape(generated, schema), `${key} ${status}`).toEqual(
          shape(expected.doc, expectedSchema),
        );
      }
    }
  });
});
