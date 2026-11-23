import {
  CardNicknameRequestSchema,
  CardPaymentsQuerySchema,
  RevealCardRequestSchema,
  type CardList,
} from '@nova/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { appError } from '../../lib/errors.js';
import { authUserId } from '../accounts/accounts.controller.js';
import type { CardsService } from './cards.service.js';
import type { PaymentsService } from './payments.service.js';

const CardIdSchema = z.uuid();

/** Un id que no es UUID se trata como inexistente: 404, igual que una tarjeta ajena (FR-010). */
function cardIdOf(req: Request): string {
  const id = CardIdSchema.safeParse(req.params.cardId);
  if (!id.success) throw appError('NOT_FOUND');
  return id.data;
}

/** Controlador de tarjetas (spec 004, US1, US2 y US4). */
export function createCardsController(deps: { cards: CardsService; payments: PaymentsService }) {
  const { cards, payments } = deps;

  return {
    /** GET /cards (operación listMyCards). */
    async listMyCards(req: Request, res: Response): Promise<void> {
      const body: CardList = { items: await cards.list(authUserId(req)) };
      res.json(body);
    },

    /** POST /cards (operación issueCard). */
    async issueCard(req: Request, res: Response): Promise<void> {
      const { nickname } = CardNicknameRequestSchema.parse(req.body);
      res.status(201).json(await cards.issue(authUserId(req), nickname, req.requestId));
    },

    /** PATCH /cards/{cardId} (operación renameCard). */
    async renameCard(req: Request, res: Response): Promise<void> {
      const cardId = cardIdOf(req);
      const { nickname } = CardNicknameRequestSchema.parse(req.body);
      res.json(await cards.rename(authUserId(req), cardId, nickname));
    },

    /** POST /cards/{cardId}/freeze (operación freezeCard). */
    async freezeCard(req: Request, res: Response): Promise<void> {
      res.json(await cards.freeze(authUserId(req), cardIdOf(req), req.requestId));
    },

    /** POST /cards/{cardId}/unfreeze (operación unfreezeCard). */
    async unfreezeCard(req: Request, res: Response): Promise<void> {
      res.json(await cards.unfreeze(authUserId(req), cardIdOf(req), req.requestId));
    },

    /** POST /cards/{cardId}/cancel (operación cancelCard). */
    async cancelCard(req: Request, res: Response): Promise<void> {
      res.json(await cards.cancel(authUserId(req), cardIdOf(req), req.requestId));
    },

    /** POST /cards/{cardId}/reveal (operación revealCard): sin caché (regla de dominio 8). */
    async revealCard(req: Request, res: Response): Promise<void> {
      const cardId = cardIdOf(req);
      const { password } = RevealCardRequestSchema.parse(req.body);
      const secrets = await cards.reveal(authUserId(req), cardId, password, req.requestId);
      res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' }).json(secrets);
    },

    /** GET /cards/{cardId}/payments (operación listCardPayments). */
    async listCardPayments(req: Request, res: Response): Promise<void> {
      const cardId = cardIdOf(req);
      const query = CardPaymentsQuerySchema.parse(req.query);
      res.json(await payments.listCardPayments(authUserId(req), cardId, query));
    },
  };
}

export type CardsController = ReturnType<typeof createCardsController>;
