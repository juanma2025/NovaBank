import { httpClient } from '../../lib/api-client.ts';
import { CardService } from './services/card-service.ts';

export const cardService = new CardService(httpClient);

export const listCards = cardService.listCards.bind(cardService);
export const issueCard = cardService.issueCard.bind(cardService);
export const renameCard = cardService.renameCard.bind(cardService);
export const freezeCard = cardService.freezeCard.bind(cardService);
export const unfreezeCard = cardService.unfreezeCard.bind(cardService);
export const cancelCard = cardService.cancelCard.bind(cardService);
export const revealCard = cardService.revealCard.bind(cardService);
export const listCardPayments = cardService.listCardPayments.bind(cardService);
