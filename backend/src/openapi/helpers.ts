import type { ResponseConfig } from '@asteasolutions/zod-to-openapi';
import { ErrorResponseSchema } from '@nova/shared';
import type { z } from 'zod';

/** Ayudantes compartidos por los archivos de `paths/`. */
export interface PathHelpers {
  json: (schema: z.ZodType, description: string) => ResponseConfig;
  err: (description: string) => ResponseConfig;
  body: (schema: z.ZodType) => {
    body: { required: true; content: { 'application/json': { schema: z.ZodType } } };
  };
}

// Sin registry.register(): exige `.openapi()` sobre los esquemas, y zod-to-openapi se carga en su
// versión CommonJS con otra copia de Zod. Los esquemas quedan en línea en el documento.
export function createPathHelpers(): PathHelpers {
  const json = (schema: z.ZodType, description: string): ResponseConfig => ({
    description,
    content: { 'application/json': { schema } },
  });
  return {
    json,
    err: (description) => json(ErrorResponseSchema, description),
    body: (schema) => ({ body: { required: true, content: { 'application/json': { schema } } } }),
  };
}
