import type { Express } from 'express';
import request from 'supertest';

const ORIGIN = 'http://localhost:5173';

/**
 * Cliente de pruebas con su propio almacén de cookies. Supertest/superagent no reenvían cookies
 * `Secure` por http, y todas las cookies de Nova son Secure (Principio III).
 */
export class TestAgent {
  readonly cookies = new Map<string, string>();
  readonly setCookieHeaders: string[] = [];

  constructor(private readonly app: Express) {}

  private cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private store(res: request.Response): request.Response {
    const raw = res.headers['set-cookie'] as string | string[] | undefined;
    const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    for (const header of list) {
      this.setCookieHeaders.push(header);
      const [pair = '', ...attrs] = header.split(';').map((s) => s.trim());
      const index = pair.indexOf('=');
      const name = pair.slice(0, index);
      const value = decodeURIComponent(pair.slice(index + 1));
      const expired = attrs.some((a) => {
        const [key = '', val = ''] = a.split('=');
        if (key.toLowerCase() === 'max-age') return Number(val) <= 0;
        if (key.toLowerCase() === 'expires') return new Date(val).getTime() <= Date.now();
        return false;
      });
      if (expired || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  async get(path: string): Promise<request.Response> {
    const res = await request(this.app)
      .get(path)
      .set('Origin', ORIGIN)
      .set('Cookie', this.cookieHeader());
    return this.store(res);
  }

  async post(path: string, body?: object): Promise<request.Response> {
    let req = request(this.app).post(path).set('Origin', ORIGIN).set('Cookie', this.cookieHeader());
    if (body !== undefined) req = req.send(body);
    return this.store(await req);
  }

  /** Atributos de la última Set-Cookie con ese nombre (para verificar HttpOnly/Secure/SameSite). */
  lastSetCookie(name: string): string | undefined {
    return this.setCookieHeaders.filter((h) => h.startsWith(`${name}=`)).at(-1);
  }
}
