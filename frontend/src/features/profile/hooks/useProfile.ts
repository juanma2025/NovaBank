import type { Profile } from '@nova/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';

export const PROFILE_QUERY_KEY = ['profile'] as const;

export function useProfile() {
  const { profileService } = useAuthServices();

  return useQuery<Profile, ApiError>({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: ({ signal }) => profileService.getMyProfile(signal),
    retry: false,
  });
}

export function useSetAlias() {
  const { profileService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Profile, ApiError, string>({
    mutationFn: (alias) => profileService.setMyAlias(alias),
    onSuccess: (updated) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, updated);
    },
  });
}

export function useRemoveAlias() {
  const { profileService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Profile, ApiError>({
    mutationFn: () => profileService.removeMyAlias(),
    onSuccess: (updated) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, updated);
    },
  });
}
