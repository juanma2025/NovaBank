import nodemailer from 'nodemailer';

import type { AppConfig } from '../../config/env.js';
import type { MailMessage, MailProvider } from './mail-provider.js';

/** Envío por SMTP con nodemailer (Mailpit en desarrollo, Brevo en la demo desplegada). */
export function createSmtpProvider(config: AppConfig): MailProvider {
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS ?? '' } } : {}),
  });
  return {
    async send(message: MailMessage) {
      await transport.sendMail({ from: config.MAIL_FROM, ...message });
    },
  };
}
