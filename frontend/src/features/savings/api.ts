import { httpClient } from '../../lib/api-client.ts';
import { SavingsService } from './services/savings-service.ts';

export const savingsService = new SavingsService(httpClient);

export const listGoals = savingsService.listGoals.bind(savingsService);
export const createGoal = savingsService.createGoal.bind(savingsService);
export const updateGoal = savingsService.updateGoal.bind(savingsService);
export const depositToGoal = savingsService.deposit.bind(savingsService);
export const withdrawFromGoal = savingsService.withdraw.bind(savingsService);
export const closeGoal = savingsService.closeGoal.bind(savingsService);
export const listGoalMovements = savingsService.listGoalMovements.bind(savingsService);
export const getSavingsLimits = savingsService.getLimits.bind(savingsService);
