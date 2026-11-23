import type { Logger } from './logger.js';

/** Eventos de dominio en proceso (spec 006, research R2). */
export interface DomainEvents {
  /** Una transferencia enviada o un pago con tarjeta se confirmó (no en repeticiones idempotentes). */
  'spending.recorded': { userId: string };
}

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => Promise<void> | void;
/** Forma común para guardarlos juntos; `on` y `emit` mantienen el tipo de cada evento. */
type StoredHandler = (payload: never) => Promise<void> | void;

/**
 * Bus de eventos en proceso. `emit` espera a los suscriptores (pruebas deterministas) pero nunca
 * lanza: el emisor ya confirmó su operación y un suscriptor que falla solo se registra en el log
 * (regla de dominio 10: el presupuesto nunca afecta un gasto).
 */
export function createEventBus(logger: Logger) {
  const handlers = new Map<keyof DomainEvents, StoredHandler[]>();

  return {
    on<K extends keyof DomainEvents>(event: K, handler: Handler<K>): void {
      handlers.set(event, [...(handlers.get(event) ?? []), handler as StoredHandler]);
    },

    async emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): Promise<void> {
      for (const handler of handlers.get(event) ?? []) {
        try {
          await (handler as Handler<K>)(payload);
        } catch (error) {
          logger.error({ err: error, event }, 'un suscriptor de evento falló');
        }
      }
    },
  };
}

export type EventBus = ReturnType<typeof createEventBus>;
