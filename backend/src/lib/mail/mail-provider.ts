export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Interfaz de envío (constitución: `MailProvider`; SMTP en la app, memoria en pruebas). */
export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}
