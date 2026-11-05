/**
 * Divide uma lista em lotes. Serve para filtros `.in('col', ids)` do PostgREST: os ids
 * vão no URL, e com centenas de ids o pedido falha (URL demasiado longo).
 * Só sintaxe apagável: chunk.test.mjs corre este ficheiro diretamente no Node.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("O tamanho do lote tem de ser um inteiro positivo.");
  }
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
}
