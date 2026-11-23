import { Prisma } from '@nova/db';
import type { Profile } from '@nova/shared';

import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AuthDirectory } from '../auth/auth.directory.js';
import { profileRepository as repo } from './profile.repository.js';

/**
 * Perfil y alias del estudiante (spec 003, US2; research R1–R2). Lee nombre y correo del
 * directorio de auth; su única tabla es `profiles`.
 */
export function createProfileService(ctx: ModuleContext, deps: { directory: AuthDirectory }) {
  const { prisma, clock, audit } = ctx;

  async function getProfile(userId: string): Promise<Profile> {
    const [user, profile] = await Promise.all([
      deps.directory.findById(prisma, userId),
      repo.findByUserId(prisma, userId),
    ]);
    if (!user) throw appError('UNAUTHENTICATED');
    return { fullName: user.fullName, email: user.email, alias: profile?.alias ?? null };
  }

  /** `alias` llega normalizado por `AliasSchema` (FR-015). */
  async function setAlias(userId: string, alias: string, requestId: string): Promise<Profile> {
    try {
      await prisma.$transaction(async (tx) => {
        const current = await repo.findByUserId(tx, userId);
        if (current?.alias === alias) return;
        await repo.upsertAlias(tx, userId, alias, clock.now());
        // Sin el alias en metadata: es un dato personal (data-model.md, AuditEvent).
        await audit.record(tx, 'ALIAS_CHANGED', { userId, requestId, metadata: { action: 'set' } });
      });
    } catch (error) {
      // Otro estudiante lo tiene, o lo obtuvo primero en una solicitud simultánea (FR-016, R2).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw appError('ALIAS_TAKEN');
      }
      throw error;
    }
    return getProfile(userId);
  }

  async function removeAlias(userId: string, requestId: string): Promise<Profile> {
    await prisma.$transaction(async (tx) => {
      const current = await repo.findByUserId(tx, userId);
      if (!current?.alias) return;
      await repo.clearAlias(tx, userId, clock.now());
      await audit.record(tx, 'ALIAS_CHANGED', {
        userId,
        requestId,
        metadata: { action: 'removed' },
      });
    });
    return getProfile(userId);
  }

  /** Para el módulo transfers: dueño del alias, o null. */
  async function findUserIdByAlias(db: Db, alias: string): Promise<string | null> {
    return (await repo.findByAlias(db, alias))?.userId ?? null;
  }

  return { getProfile, setAlias, removeAlias, findUserIdByAlias };
}

export type ProfileService = ReturnType<typeof createProfileService>;
