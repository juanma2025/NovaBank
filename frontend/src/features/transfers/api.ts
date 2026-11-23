import { httpClient } from '../../lib/api-client.ts';
import { TransferService } from './services/transfer-service.ts';

export const transferService = new TransferService(httpClient);

export const findRecipient = transferService.findRecipient.bind(transferService);
export const getTransferLimits = transferService.getLimits.bind(transferService);
export const createTransfer = transferService.createTransfer.bind(transferService);
