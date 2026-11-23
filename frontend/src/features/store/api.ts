import { httpClient } from '../../lib/api-client.ts';
import { StoreService } from './services/store-service.ts';

export const storeService = new StoreService(httpClient);

export const getStoreLimits = storeService.getLimits.bind(storeService);
export const payInStore = storeService.pay.bind(storeService);
