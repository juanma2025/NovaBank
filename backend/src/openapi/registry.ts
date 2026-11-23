import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import { createPathHelpers } from './helpers.js';
import { registerAuthPaths } from './paths/auth.js';
import { registerAccountsPaths } from './paths/accounts.js';
import { registerTransfersPaths } from './paths/transfers.js';
import { registerCardsPaths } from './paths/cards.js';
import { registerSavingsPaths } from './paths/savings.js';
import { registerBudgetsPaths } from './paths/budgets.js';
import { registerSplitsPaths } from './paths/splits.js';

/**
 * Documento OpenAPI generado desde los esquemas de @nova/shared (spec 001 research R12). Cada módulo
 * registra sus operaciones en `paths/`; la prueba de contrato exige que coincidan con todos los
 * contratos de specs/*\/contracts/.
 */
export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();
  const helpers = createPathHelpers();
  registerAuthPaths(registry, helpers);
  registerAccountsPaths(registry, helpers);
  registerTransfersPaths(registry, helpers);
  registerCardsPaths(registry, helpers);
  registerSavingsPaths(registry, helpers);
  registerBudgetsPaths(registry, helpers);
  registerSplitsPaths(registry, helpers);

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'Nova API', version: '1.0.0' },
    servers: [{ url: '/api/v1' }],
  });
}
