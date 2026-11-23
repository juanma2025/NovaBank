import type { Db } from '../../lib/db.js';
import { userRepository } from './repositories/user.repository.js';

export { maskEmail } from './verification.service.js';

/** Datos públicos de un estudiante que otros módulos pueden leer (spec 003, research R1). */
export interface DirectoryEntry {
  userId: string;
  fullName: string;
  email: string;
}

/**
 * Directorio de estudiantes: única vía para que otros módulos lean `users` (Principio VI). Nunca
 * expone el hash de la contraseña ni otros campos internos.
 */
export function createAuthDirectory() {
  const toEntry = (user: { id: string; fullName: string; email: string }): DirectoryEntry => ({
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
  });

  return {
    /** El correo debe llegar normalizado (`normalizeEmail`). */
    async findByEmail(db: Db, email: string): Promise<DirectoryEntry | null> {
      const user = await userRepository.findByEmail(db, email);
      return user ? toEntry(user) : null;
    },

    async findById(db: Db, userId: string): Promise<DirectoryEntry | null> {
      const user = await userRepository.findById(db, userId);
      return user ? toEntry(user) : null;
    },
  };
}

export type AuthDirectory = ReturnType<typeof createAuthDirectory>;
