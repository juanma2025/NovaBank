import { httpClient } from '../../lib/api-client.ts';
import { ProfileService } from './services/profile-service.ts';

export const profileService = new ProfileService(httpClient);

export const getMyProfile = profileService.getMyProfile.bind(profileService);
export const setMyAlias = profileService.setMyAlias.bind(profileService);
export const removeMyAlias = profileService.removeMyAlias.bind(profileService);
