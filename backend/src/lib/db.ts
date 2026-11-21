import type { Prisma, PrismaClient } from '@nova/db';

/** Cliente Prisma o cliente de transacción: los repositorios aceptan ambos. */
export type Db = PrismaClient | Prisma.TransactionClient;

export type { PrismaClient };
