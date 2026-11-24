import type { CardPaymentResult, CreateCardPaymentRequest, PaymentLimits } from '@nova/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';
import { ACCOUNT_QUERY_KEY } from '../../accounts/hooks/useAccount.ts';
import { MOVEMENTS_QUERY_KEY } from '../../accounts/hooks/useMovements.ts';
import { IdempotencyKeyManager } from '../../accounts/services/idempotency-key-manager.ts';
import { CARDS_QUERY_KEY } from '../../cards/hooks/useCards.ts';

export const STORE_LIMITS_QUERY_KEY = ['store-limits'] as const;

export function useStoreLimits() {
  const { storeService } = useAuthServices();

  return useQuery<PaymentLimits, ApiError>({
    queryKey: STORE_LIMITS_QUERY_KEY,
    queryFn: ({ signal }) => storeService.getLimits(signal),
    retry: false,
  });
}

/**
 * Pago idempotente en tienda demo (spec 004, T028).
 * La huella de intento excluye número, vencimiento y CVV (research R6).
 */
export function useCreateCardPayment() {
  const { storeService } = useAuthServices();
  const queryClient = useQueryClient();
  const keyManagerRef = useRef<IdempotencyKeyManager | null>(null);
  keyManagerRef.current ??= new IdempotencyKeyManager();

  const mutation = useMutation<CardPaymentResult, ApiError, CreateCardPaymentRequest>({
    mutationFn: async (payload) => {
      const fingerprint = JSON.stringify({
        merchantId: payload.merchantId,
        amount: payload.amount,
      });
      const key = keyManagerRef.current?.getOrCreateForAttempt(fingerprint) ?? crypto.randomUUID();
      return storeService.pay(payload, key);
    },
    onSuccess: async () => {
      keyManagerRef.current?.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: STORE_LIMITS_QUERY_KEY }),
      ]);
    },
    onError: (error) => {
      const isRetryableTransport = error.code === 'NETWORK' || error.status >= 500;
      if (!isRetryableTransport) {
        keyManagerRef.current?.reset();
      }
    },
  });

  const resetAttempt = useCallback(() => {
    keyManagerRef.current?.reset();
  }, []);

  return {
    ...mutation,
    resetAttempt,
  };
}
