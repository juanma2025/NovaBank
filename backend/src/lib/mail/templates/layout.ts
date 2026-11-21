const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** Envoltorio HTML mínimo con la marca Nova. Los párrafos se escapan. */
export function renderHtml(title: string, paragraphs: string[], highlight?: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join('');
  const code = highlight
    ? `<p style="font-size:32px;letter-spacing:8px;font-weight:600;margin:24px 0">${escapeHtml(highlight)}</p>`
    : '';
  return `<!doctype html><html lang="es"><body style="font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;color:#111;padding:24px">
<h1 style="font-size:20px;margin:0 0 24px">Nova · ${escapeHtml(title)}</h1>${code}${body}
<p style="color:#666;font-size:12px;margin-top:32px">Nova es un proyecto académico. Nunca te pediremos tu contraseña por correo.</p>
</body></html>`;
}
