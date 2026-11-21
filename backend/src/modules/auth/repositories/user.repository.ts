import type { User } from '@nova/db';

import type { Db } from '../../../lib/db.js';

export interface NewUser {
  email: string;
  fullName: string;
  passwordHash: string;
  now: Date;
}

/** Acceso a `users` (data-model.md `User`). El correo llega siempre normalizado. */
export const userRepository = {
  findByEmail(db: Db, email: string): Promise<User | null> {
    return db.user.findUnique({ where: { email } });
  },

  findById(db: Db, id: string): Promise<User | null> {
    return db.user.findUnique({ where: { id } });
  },

  /** Cambio por recuperación: data-model.md `User.password_hash` y `User.password_changed_at`. */
  async updatePassword(db: Db, id: string, passwordHash: string, now: Date): Promise<void> {
    await db.user.update({ where: { id }, data: { passwordHash, passwordChangedAt: now } });
  },

  create(db: Db, { email, fullName, passwordHash, now }: NewUser): Promise<User> {
    return db.user.create({
      data: { email, fullName, passwordHash, passwordChangedAt: now, createdAt: now },
    });
  },
};
