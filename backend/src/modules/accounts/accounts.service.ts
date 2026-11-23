import type { Account } from '@nova/db';

import type { Db } from '../../lib/db.js';
import { toSafeNumber } from '../../lib/money.js';
import type { ModuleContext } from '../../lib/module-context.js';
import { accountsRepository as repo } from './accounts.repository.js';

/** Cuenta con el saldo ya convertido a `number` (Principio I). */
export interface AccountView {
  id: string;
  userId: string | null;
  kind: Account['kind'];
  currency: 'COP';
  balance: number;
}

function toView(account: Account): AccountView {
  return {
    id: account.id,
    userId: account.userId,
    kind: account.kind,
    currency: 'COP',
    balance: toSafeNumber(account.balance),
  };
}

/**
 * Servicio público del módulo accounts (spec 002, research R1). Otros módulos lo usan; nunca
 * acceden a la tabla `accounts` directamente (Principio VI).
 */
export function createAccountsService(ctx: Pick<ModuleContext, 'clock'>) {
  let systemTopupsId: string | null = null;
  let systemMerchantsId: string | null = null;

  /** Cuenta del estudiante; la crea si no existe (FR-001, research R6). */
  async function ensureForUser(db: Db, userId: string): Promise<AccountView> {
    const existing = await repo.findByUserId(db, userId);
    if (existing) return toView(existing);
    await repo.insertStudentIfMissing(db, userId, ctx.clock.now());
    const created = await repo.findByUserId(db, userId);
    if (!created) throw new Error('no se pudo crear la cuenta del estudiante');
    return toView(created);
  }

  /** Bloquea la cuenta para una operación de dinero (regla de dominio 3). */
  async function lockForUpdate(tx: Db, accountId: string): Promise<AccountView> {
    const account = await repo.lockById(tx, accountId);
    if (!account) throw new Error(`cuenta inexistente: ${accountId}`);
    return toView(account);
  }

  /**
   * Bloquea varias cuentas en orden de id (spec 003, research R6) y las devuelve en el orden pedido.
   * Las ids deben ser distintas y existir.
   */
  async function lockManyForUpdate(tx: Db, accountIds: string[]): Promise<AccountView[]> {
    const locked = await repo.lockManyById(tx, accountIds);
    return accountIds.map((id) => {
      const account = locked.find((a) => a.id === id);
      if (!account) throw new Error(`cuenta inexistente: ${id}`);
      return toView(account);
    });
  }

  /** Cuenta de estudiante por id, o null si no existe o no es de estudiante (spec 003). */
  async function findStudentAccountById(db: Db, accountId: string): Promise<AccountView | null> {
    const account = await repo.findStudentById(db, accountId);
    return account ? toView(account) : null;
  }

  /**
   * Aplica un cambio al saldo materializado de cuentas de estudiantes y subcuentas de metas; el
   * CHECK de la base rechaza un saldo negativo (data-model.md `Account.balance`, spec 005 R2).
   */
  async function applyBalanceDelta(tx: Db, accountId: string, delta: number): Promise<void> {
    await repo.incrementMaterializedBalance(tx, accountId, BigInt(delta));
  }

  async function getSystemTopupsAccountId(db: Db): Promise<string> {
    if (systemTopupsId) return systemTopupsId;
    const system = await repo.findSystemTopups(db);
    if (!system) throw new Error('falta la cuenta del sistema (migración accounts_ledger)');
    systemTopupsId = system.id;
    return system.id;
  }

  /** Spec 004: igual que `system_topups`, nunca se bloquea ni tiene saldo materializado. */
  async function getSystemMerchantsAccountId(db: Db): Promise<string> {
    if (systemMerchantsId) return systemMerchantsId;
    const system = await repo.findSystemMerchants(db);
    if (!system) throw new Error('falta la cuenta system_merchants (migración cards)');
    systemMerchantsId = system.id;
    return system.id;
  }

  /** Spec 005: crea la subcuenta de una meta de ahorro (research R2). */
  async function createSavingsAccount(tx: Db): Promise<AccountView> {
    return toView(await repo.createSavingsGoal(tx, ctx.clock.now()));
  }

  /** Saldos por id de cuenta (para listar metas). */
  async function balancesByIds(db: Db, ids: string[]): Promise<Map<string, number>> {
    const rows = await repo.findManyByIds(db, ids);
    return new Map(rows.map((row) => [row.id, toSafeNumber(row.balance)]));
  }

  return {
    ensureForUser,
    lockForUpdate,
    lockManyForUpdate,
    findStudentAccountById,
    applyBalanceDelta,
    getSystemTopupsAccountId,
    getSystemMerchantsAccountId,
    createSavingsAccount,
    balancesByIds,
  };
}

export type AccountsService = ReturnType<typeof createAccountsService>;
