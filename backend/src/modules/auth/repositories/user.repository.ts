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

  create(db: Db, { email, fullName, passwordHash, now }: NewUser): Promise<User> {
    return db.user.create({
      data: { email, fullName, passwordHash, passwordChangedAt: now, createdAt: now },
    });
  },
};
