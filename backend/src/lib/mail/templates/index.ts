import type { EmailTemplate } from '@nova/db';

import { renderHtml } from './layout.js';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Datos que cada plantilla necesita para renderizarse. */
export type TemplateData = Record<string, string | number>;

function requireString(data: TemplateData, key: string): string {
  const value = data[key];
  if (value === undefined) throw new Error(`plantilla: falta «${key}»`);
  return String(value);
}

function codeEmail(title: string, intro: string, data: TemplateData): RenderedEmail {
  const code = requireString(data, 'code');
  const minutes = requireString(data, 'minutes');
  const paragraphs = [
    intro,
    `El código vence en ${minutes} minutos y solo sirve una vez.`,
    'Si no fuiste tú, ignora este correo.',
  ];
  return {
    subject: `${code} es tu código de Nova`,
    text: `${intro}\n\nTu código: ${code}\n\n${paragraphs.slice(1).join('\n')}`,
    html: renderHtml(title, paragraphs, code),
  };
}

/** Las 4 plantillas en español (data-model.md `EmailOutbox.template`; tasks.md T029). */
export function renderTemplate(template: EmailTemplate, data: TemplateData): RenderedEmail {
  switch (template) {
    case 'verification_code':
      return codeEmail('Verifica tu correo', 'Usa este código para crear tu cuenta en Nova.', data);
    case 'password_reset_code':
      return codeEmail(
        'Recupera tu contraseña',
        'Usa este código para crear una contraseña nueva en Nova.',
        data,
      );
    case 'already_registered': {
      const paragraphs = [
        'Alguien intentó crear una cuenta en Nova con este correo, pero ya tienes una.',
        'Si fuiste tú, inicia sesión. Si olvidaste tu contraseña, usa «¿Olvidaste tu contraseña?».',
        'Si no fuiste tú, puedes ignorar este correo: tu cuenta sigue segura.',
      ];
      return {
        subject: 'Ya tienes una cuenta en Nova',
        text: paragraphs.join('\n\n'),
        html: renderHtml('Ya tienes una cuenta', paragraphs),
      };
    }
    case 'password_changed': {
      const paragraphs = [
        'La contraseña de tu cuenta de Nova acaba de cambiar y cerramos todas tus sesiones abiertas.',
        'Si no fuiste tú, recupera tu contraseña de inmediato desde la pantalla de inicio de sesión.',
      ];
      return {
        subject: 'Tu contraseña de Nova cambió',
        text: paragraphs.join('\n\n'),
        html: renderHtml('Tu contraseña cambió', paragraphs),
      };
    }
  }
}
