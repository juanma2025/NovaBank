import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
} from 'node:crypto';

import { CARD_NUMBER_LENGTH, luhnCheckDigit } from '@nova/shared';

const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Prefijo fuera de las franquicias reales (ISO/IEC 7812, asignación nacional; research R2). */
const PAN_PREFIX = '9';

/**
 * Criptografía de la tarjeta virtual (spec 004, research R2 y R3). De `CARD_ENCRYPTION_KEY` se
 * derivan con HKDF tres subclaves independientes: cifrado del número, HMAC de búsqueda y CVV.
 */
export function createCardCrypto(hexKey: string) {
  const master = Buffer.from(hexKey, 'hex');
  if (master.length !== 32) throw new Error('CARD_ENCRYPTION_KEY debe tener 32 bytes');
  const derive = (label: string): Buffer =>
    Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), `nova:cards:${label}`, 32));
  const kEnc = derive('enc');
  const kLookup = derive('lookup');
  const kCvv = derive('cvv');

  return {
    /** AES-256-GCM; devuelve iv ‖ tag ‖ texto cifrado (como `Bytes` de Prisma). */
    encryptPan(pan: string): Uint8Array<ArrayBuffer> {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv('aes-256-gcm', kEnc, iv);
      const encrypted = Buffer.concat([cipher.update(pan, 'utf8'), cipher.final()]);
      return Uint8Array.from(Buffer.concat([iv, cipher.getAuthTag(), encrypted]));
    },

    /** Lanza un error si el texto cifrado fue alterado o la clave es otra. */
    decryptPan(data: Uint8Array): string {
      const buffer = Buffer.from(data);
      const iv = buffer.subarray(0, IV_BYTES);
      const tag = buffer.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
      const decipher = createDecipheriv('aes-256-gcm', kEnc, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(buffer.subarray(IV_BYTES + TAG_BYTES)),
        decipher.final(),
      ]).toString('utf8');
    },

    /** HMAC del número para encontrar la tarjeta sin descifrar (data-model.md `Card.pan_hash`). */
    panHash(pan: string): string {
      return createHmac('sha256', kLookup).update(pan).digest('hex');
    },

    /** CVV derivado: estable para la misma tarjeta, imposible de calcular sin la clave. */
    deriveCvv(card: { id: string; pan: string; expMonth: number; expYear: number }): string {
      const expiry = `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear % 100).padStart(2, '0')}`;
      const mac = createHmac('sha256', kCvv).update(`${card.id}:${card.pan}:${expiry}`).digest();
      return String(mac.readUInt32BE(0) % 1000).padStart(3, '0');
    },
  };
}

export type CardCrypto = ReturnType<typeof createCardCrypto>;

/** Número de 16 dígitos: prefijo 9, dígitos aleatorios y dígito de control Luhn. */
export function generatePan(): string {
  let body = PAN_PREFIX;
  while (body.length < CARD_NUMBER_LENGTH - 1) body += String(randomInt(10));
  return `${body}${luhnCheckDigit(body)}`;
}
