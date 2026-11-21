// Propiedades que los middlewares de Nova agregan a la solicitud.
declare global {
  namespace Express {
    interface Request {
      /** UUID v4 de trazabilidad (middleware request-id). */
      requestId: string;
      /** Sesión validada (middleware require-auth). */
      auth?: { userId: string; sessionId: string };
    }
  }
}

export {};
