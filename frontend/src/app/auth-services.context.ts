import { createContext, useContext } from 'react';

import { AccountService } from '../features/accounts/services/account-service.ts';
import { BalanceVisibilityStore } from '../features/accounts/services/balance-visibility-store.ts';
import { TopupService } from '../features/accounts/services/topup-service.ts';
import { AuthService } from '../features/auth/services/auth-service.ts';
import { SessionBroadcaster } from '../features/auth/services/session-broadcaster.ts';
import { BudgetService } from '../features/budgets/services/budget-service.ts';
import { CardService } from '../features/cards/services/card-service.ts';
import { ProfileService } from '../features/profile/services/profile-service.ts';
import { SavingsService } from '../features/savings/services/savings-service.ts';
import { StoreService } from '../features/store/services/store-service.ts';
import { TransferService } from '../features/transfers/services/transfer-service.ts';
import { httpClient, type HttpClient } from '../lib/api-client.ts';
import { themeController, type ThemeController } from '../lib/theme-controller.ts';

export interface AuthServices {
  httpClient: HttpClient;
  authService: AuthService;
  accountService: AccountService;
  topupService: TopupService;
  transferService: TransferService;
  profileService: ProfileService;
  cardService: CardService;
  storeService: StoreService;
  savingsService: SavingsService;
  budgetService: BudgetService;
  balanceVisibilityStore: BalanceVisibilityStore;
  themeController: ThemeController;
  createBroadcaster: () => SessionBroadcaster;
}

export function createDefaultAuthServices(overrides?: Partial<AuthServices>): AuthServices {
  const client = overrides?.httpClient ?? httpClient;
  const authService = overrides?.authService ?? new AuthService(client);
  const accountService = overrides?.accountService ?? new AccountService(client);
  const topupService = overrides?.topupService ?? new TopupService(client);
  const transferService = overrides?.transferService ?? new TransferService(client);
  const profileService = overrides?.profileService ?? new ProfileService(client);
  const cardService = overrides?.cardService ?? new CardService(client);
  const storeService = overrides?.storeService ?? new StoreService(client);
  const savingsService = overrides?.savingsService ?? new SavingsService(client);
  const budgetService = overrides?.budgetService ?? new BudgetService(client);
  const balanceVisibilityStore = overrides?.balanceVisibilityStore ?? new BalanceVisibilityStore();
  const resolvedTheme = overrides?.themeController ?? themeController;
  const createBroadcaster = overrides?.createBroadcaster ?? (() => new SessionBroadcaster());
  return {
    httpClient: client,
    authService,
    accountService,
    topupService,
    transferService,
    profileService,
    cardService,
    storeService,
    savingsService,
    budgetService,
    balanceVisibilityStore,
    themeController: resolvedTheme,
    createBroadcaster,
  };
}

const DEFAULT_SERVICES = createDefaultAuthServices();

export const AuthServicesContext = createContext<AuthServices>(DEFAULT_SERVICES);

export function useAuthServices(): AuthServices {
  return useContext(AuthServicesContext);
}
