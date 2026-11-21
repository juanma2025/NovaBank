import type { MailMessage, MailProvider } from '../../src/lib/mail/mail-provider.js';

/** Proveedor de correo en memoria: nunca se envían correos reales en pruebas (constitución). */
export class MemoryMailProvider implements MailProvider {
  readonly messages: MailMessage[] = [];
  /** Si es > 0, los siguientes envíos fallan (para probar reintentos). */
  failNext = 0;

  send(message: MailMessage): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      return Promise.reject(new Error('SMTP caído (simulado)'));
    }
    this.messages.push(message);
    return Promise.resolve();
  }

  to(email: string): MailMessage[] {
    return this.messages.filter((m) => m.to === email);
  }

  /** Último código de 6 dígitos enviado a un correo. */
  lastCodeFor(email: string): string {
    const last = this.to(email).at(-1);
    const match = last?.text.match(/\b(\d{6})\b/);
    if (!match?.[1]) throw new Error(`No hay código para ${email}`);
    return match[1];
  }

  clear(): void {
    this.messages.length = 0;
  }
}
