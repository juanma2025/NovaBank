import { SetAliasRequestSchema } from '@nova/shared';
import type { Request, Response } from 'express';

import { authUserId } from '../accounts/accounts.controller.js';
import type { ProfileService } from './profile.service.js';

/** Controlador del perfil (spec 003, US2). Solo `/me`. */
export function createProfileController(deps: { profile: ProfileService }) {
  return {
    /** GET /profile/me (operación getMyProfile). */
    async getMyProfile(req: Request, res: Response): Promise<void> {
      res.json(await deps.profile.getProfile(authUserId(req)));
    },

    /** PUT /profile/me/alias (operación setMyAlias). */
    async setMyAlias(req: Request, res: Response): Promise<void> {
      const { alias } = SetAliasRequestSchema.parse(req.body);
      res.json(await deps.profile.setAlias(authUserId(req), alias, req.requestId));
    },

    /** DELETE /profile/me/alias (operación removeMyAlias). */
    async removeMyAlias(req: Request, res: Response): Promise<void> {
      res.json(await deps.profile.removeAlias(authUserId(req), req.requestId));
    },
  };
}

export type ProfileController = ReturnType<typeof createProfileController>;
