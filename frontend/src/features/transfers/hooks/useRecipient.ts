import type { RecipientPreview } from '@nova/shared';
import { useMutation } from '@tanstack/react-query';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';

export function useRecipient() {
  const { transferService } = useAuthServices();

  return useMutation<RecipientPreview, ApiError, string>({
    mutationFn: (query) => transferService.findRecipient(query),
  });
}
