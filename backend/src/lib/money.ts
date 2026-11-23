/**
 * Conversión del `bigint` que entrega Prisma para columnas BIGINT a `number` entero seguro
 * (constitución, Principio I v2.1.0). Fuera de los repositorios el dinero siempre es `number`.
 */
export function toSafeNumber(value: bigint): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new Error(`monto fuera del rango de enteros seguros: ${value.toString()}`);
  }
  return n;
}
