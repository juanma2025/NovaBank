import {
  type ApiRequestOptions,
  type ContactListener,
  HttpClient,
  type SessionExpiredHandler,
} from './http-client.ts';

export {
  ApiError,
  type ApiErrorCode,
  type ApiRequestOptions,
  type ContactListener,
  HttpClient,
  type HttpClientOptions,
  type SessionExpiredHandler,
} from './http-client.ts';

/** Instancia compartida por defecto de `HttpClient` (los proveedores pueden inyectar otra). */
export const httpClient = new HttpClient();

export function getLastServerContactAt(): number | null {
  return httpClient.lastServerContactAt;
}

export function subscribeServerContact(listener: ContactListener): () => void {
  return httpClient.subscribeServerContact(listener);
}

export function resetLastServerContactAt(): void {
  httpClient.resetLastServerContactAt();
}

export function setOnSessionExpired(handler: SessionExpiredHandler | null): void {
  httpClient.setOnSessionExpired(handler);
}

export function apiRequest<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  return httpClient.request<T>(path, options);
}

export function apiRequestVoid(path: string, options?: ApiRequestOptions): Promise<void> {
  return httpClient.requestVoid(path, options);
}
