import type { TopupResult } from '@nova/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';
import { ACCOUNT_QUERY_KEY } from '../../accounts/hooks/useAccount.ts';
import { MOVEMENTS_QUERY_KEY } from '../../accounts/hooks/useMovements.ts';
import { IdempotencyKeyManager } from '../../accounts/services/idempotency-key-manager.ts';
import { TOPUP_LIMITS_QUERY_KEY } from './useTopupLimits.ts';

/**
 * Orquesta `POST /topups` con `IdempotencyKeyManager`:
 * - Genera `crypto.randomUUID()` una sola vez por intento confirmado.
 * - Reutiliza la misma clave al reintentar tras error de red o doble clic.
 * - Invalida `['account']`, `['movements']` y `['topups', 'limits']` al confirmar.
 */
export function useCreateTopup() {
  const { topupService } = useAuthServices();
  const queryClient = useQueryClient();
  const keyManagerRef = useRef<IdempotencyKeyManager | null>(null);

  const getKeyManager = useCallback((): IdempotencyKeyManager => {
    keyManagerRef.current ??= new IdempotencyKeyManager();
    return keyManagerRef.current;
  }, []);

  const mutation = useMutation<TopupResult, ApiError, number>({
    mutationFn: (amount) => {
      const idempotencyKey = getKeyManager().getOrCreateForAttempt(String(amount));
      return topupService.createTopup({ amount }, idempotencyKey);
    },
    onSuccess: () => {
      getKeyManager().reset();
      void queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: TOPUP_LIMITS_QUERY_KEY });
    },
    onError: (error) => {
      if (error.code === 'IDEMPOTENCY_KEY_REUSED') {
        getKeyManager().reset();
      }
    },
  });

  const resetAttempt = useCallback(() => {
    getKeyManager().reset();
    mutation.reset();
  }, [getKeyManager, mutation]);

  return {
    ...mutation,
    resetAttempt,
  };
}
