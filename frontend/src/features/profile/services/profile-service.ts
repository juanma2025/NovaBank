import { type Profile, ProfileSchema } from '@nova/shared';

import type { HttpClient } from '../../../lib/http-client.ts';

/**
 * Servicio POO para consultar y administrar el perfil y alias del estudiante (spec 003).
 */
export class ProfileService {
  constructor(private readonly http: HttpClient) {}

  async getMyProfile(signal?: AbortSignal): Promise<Profile> {
    const data = await this.http.request<unknown>('/profile/me', {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return ProfileSchema.parse(data);
  }

  async setMyAlias(alias: string, signal?: AbortSignal): Promise<Profile> {
    const data = await this.http.request<unknown>('/profile/me/alias', {
      method: 'PUT',
      body: { alias },
      ...(signal ? { signal } : {}),
    });
    return ProfileSchema.parse(data);
  }

  async removeMyAlias(signal?: AbortSignal): Promise<Profile> {
    const data = await this.http.request<unknown>('/profile/me/alias', {
      method: 'DELETE',
      ...(signal ? { signal } : {}),
    });
    return ProfileSchema.parse(data);
  }
}
