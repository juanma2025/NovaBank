import { appError } from './errors.js';

/** Posición en una lista ordenada por (created_at DESC, id DESC) (spec 002, research R8). */
export interface CursorPosition {
  createdAt: Date;
  id: string;
}

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify([position.createdAt.toISOString(), position.id])).toString(
    'base64url',
  );
}

/** Un cursor inválido responde 400 VALIDATION_ERROR. */
export function decodeCursor(cursor: string): CursorPosition {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
      const createdAt = new Date(parsed[0]);
      if (!Number.isNaN(createdAt.getTime()) && /^[0-9a-f-]{36}$/i.test(parsed[1])) {
        return { createdAt, id: parsed[1] };
      }
    }
  } catch {
    // cae al error de validación
  }
  throw appError('VALIDATION_ERROR', { fields: { cursor: 'invalid' } });
}
