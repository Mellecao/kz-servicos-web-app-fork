/**
 * Interruptor `system_settings.trips_enabled` (jsonb boolean): liga ou desliga as
 * viagens/caronas no Painel. Nada de viagens é apagado; com `false` ficam só
 * inativas (sem menu, sem KPIs no dashboard, /viagens redireciona).
 *
 * Só sintaxe apagável: trips-enabled.test.mjs corre este ficheiro diretamente no Node.
 */

export const TRIPS_ENABLED_KEY = "trips_enabled";
export const TRIPS_PATH = "/viagens";
export const TRIPS_REDIRECT_PATH = "/outros-servicos";

/**
 * jsonb → boolean. À prova de falha: só `true` (ou o texto "true") liga as viagens;
 * ausente, nulo ou qualquer valor estranho conta como desligado.
 */
export function parseTripsEnabled(value: unknown): boolean {
  if (value === true) return true;
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

/** /viagens e tudo por baixo (não apanha /viagens-futuro). Ignora ?query e #hash. */
export function isTripsPath(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0];
  return path === TRIPS_PATH || path.startsWith(`${TRIPS_PATH}/`);
}

/** Para onde mandar quem abre uma página de viagens com o interruptor desligado; null se não há que redirecionar. */
export function tripsRedirectTarget(pathname: string, enabled: boolean): string | null {
  return !enabled && isTripsPath(pathname) ? TRIPS_REDIRECT_PATH : null;
}

/** Tira do menu as entradas de viagens quando o interruptor está desligado; ligado devolve o menu completo. */
export function withoutTripsItems<T extends { href: string }>(items: T[], enabled: boolean): T[] {
  return enabled ? items : items.filter((item) => !isTripsPath(item.href));
}
