import { httpClient } from '../../lib/api-client.ts';
import { BudgetService } from './services/budget-service.ts';

export const budgetService = new BudgetService(httpClient);
export { BudgetService };
