import { useCallback, useEffect, useState } from 'react';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import { BALANCE_VISIBILITY_STORAGE_KEY } from '../services/balance-visibility-store.ts';

export interface UseBalanceVisibilityResult {
  hidden: boolean;
  toggle: () => void;
  setHidden: (next: boolean) => void;
}

/**
 * Sincroniza la preferencia de ocultar saldo y montos con `BalanceVisibilityStore`
 * dentro de la pestaña actual y entre pestañas del mismo dispositivo.
 */
export function useBalanceVisibility(): UseBalanceVisibilityResult {
  const { balanceVisibilityStore } = useAuthServices();
  const [hidden, setHiddenState] = useState<boolean>(() => balanceVisibilityStore.isHidden());

  useEffect(() => {
    setHiddenState(balanceVisibilityStore.isHidden());
    const unsubscribe = balanceVisibilityStore.subscribe((next) => {
      setHiddenState(next);
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key === BALANCE_VISIBILITY_STORAGE_KEY) {
        setHiddenState(balanceVisibilityStore.isHidden());
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, [balanceVisibilityStore]);

  const toggle = useCallback(() => {
    balanceVisibilityStore.toggle();
  }, [balanceVisibilityStore]);

  const setHidden = useCallback(
    (next: boolean) => {
      balanceVisibilityStore.setHidden(next);
    },
    [balanceVisibilityStore],
  );

  return { hidden, toggle, setHidden };
}
