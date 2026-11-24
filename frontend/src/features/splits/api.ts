import { httpClient } from '../../lib/api-client.ts';
import { SplitsService } from './services/splits-service.ts';

export const splitsService = new SplitsService(httpClient);
export { SplitsService };
