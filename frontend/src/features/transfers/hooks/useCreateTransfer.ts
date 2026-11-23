import type { CreateTransferRequest, TransferResult } from '@nova/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';
import { ACCOUNT_QUERY_KEY } from '../../accounts/hooks/useAccount.ts';
import { MOVEMENTS_QUERY_KEY } from '../../accounts/hooks/useMovements.ts';
import { IdempotencyKeyManager } from '../../accounts/services/idempotency-key-manager.ts';
import {
  BUDGET_ALERTS_QUERY_KEY,
  BUDGET_QUERY_KEY,
  BUDGET_TRANSFERS_QUERY_KEY,
} from '../../budgets/hooks/useBudgets.ts';
import { TRANSFER_LIMITS_QUERY_KEY } from './useTransferLimits.ts';

/**
 * Envío idempotente de transferencia (spec 003, T019).
 * Genera la `Idempotency-Key` una sola vez por intento y la reutiliza en reintentos de red.
 */
export function useCreateTransfer() {
  const { transferService } = useAuthServices();
  const queryClient = useQueryClient();
  const keyManagerRef = useRef<IdempotencyKeyManager | null>(null);
  keyManagerRef.current ??= new IdempotencyKeyManager();

  const mutation = useMutation<TransferResult, ApiError, CreateTransferRequest>({
    mutationFn: async (payload) => {
      const fingerprint = JSON.stringify({
        recipientId: payload.recipientId,
        amount: payload.amount,
        note: payload.note ?? null,
      });
      const key = keyManagerRef.current?.getOrCreateForAttempt(fingerprint) ?? crypto.randomUUID();
      return transferService.createTransfer(payload, key);
    },
    onSuccess: async () => {
      keyManagerRef.current?.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: TRANSFER_LIMITS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: BUDGET_ALERTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: BUDGET_TRANSFERS_QUERY_KEY }),
      ]);
    },
    onError: (error) => {
      // Ante error de validación, fondos, reauth o conflicto, descartamos la clave para el siguiente intento;
      // ante fallo de red o 5xx conservamos la misma clave para reintento idempotente.
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
