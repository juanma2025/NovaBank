import { createContext, useContext } from 'react';

import { AccountService } from '../features/accounts/services/account-service.ts';
import { BalanceVisibilityStore } from '../features/accounts/services/balance-visibility-store.ts';
import { TopupService } from '../features/accounts/services/topup-service.ts';
import { AuthService } from '../features/auth/services/auth-service.ts';
import { SessionBroadcaster } from '../features/auth/services/session-broadcaster.ts';
import { httpClient, type HttpClient } from '../lib/api-client.ts';

export interface AuthServices {
  httpClient: HttpClient;
  authService: AuthService;
  accountService: AccountService;
  topupService: TopupService;
  balanceVisibilityStore: BalanceVisibilityStore;
  createBroadcaster: () => SessionBroadcaster;
}

export function createDefaultAuthServices(overrides?: Partial<AuthServices>): AuthServices {
  const client = overrides?.httpClient ?? httpClient;
  const authService = overrides?.authService ?? new AuthService(client);
  const accountService = overrides?.accountService ?? new AccountService(client);
  const topupService = overrides?.topupService ?? new TopupService(client);
  const balanceVisibilityStore = overrides?.balanceVisibilityStore ?? new BalanceVisibilityStore();
  const createBroadcaster = overrides?.createBroadcaster ?? (() => new SessionBroadcaster());
  return {
    httpClient: client,
    authService,
    accountService,
    topupService,
    balanceVisibilityStore,
    createBroadcaster,
  };
}

const DEFAULT_SERVICES = createDefaultAuthServices();

export const AuthServicesContext = createContext<AuthServices>(DEFAULT_SERVICES);

export function useAuthServices(): AuthServices {
  return useContext(AuthServicesContext);
}
