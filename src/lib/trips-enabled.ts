/**
 * Interruptor `system_settings.trips_enabled` (jsonb boolean): liga ou desliga as
 * viagens/caronas no Painel. Nada de viagens é apagado; com `false` ficam só
 * inativas (sem menu, sem KPIs no dashboard; /viagens, /mapa e /motoristas redirecionam).
 *
 * Só sintaxe apagável: trips-enabled.test.mjs corre este ficheiro diretamente no Node.
 */

export const TRIPS_ENABLED_KEY = "trips_enabled";
/**
 * Páginas que só existem com as caronas ligadas: as viagens e as duas que só servem
 * viagens/motoristas (mapa de motoristas e gestão de motoristas). Com o interruptor
 * desligado saem do menu e redirecionam; o código e os dados ficam.
 */
export const TRIPS_ONLY_PATHS = ["/viagens", "/mapa", "/motoristas"] as const;
export const TRIPS_REDIRECT_PATH = "/outros-servicos";

/**
 * jsonb → boolean. À prova de falha: só `true` (ou o texto "true") liga as viagens;
 * ausente, nulo ou qualquer valor estranho conta como desligado.
 */
export function parseTripsEnabled(value: unknown): boolean {
  if (value === true) return true;
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

/** Uma das páginas só de caronas ou algo por baixo dela (não apanha /mapa-futuro). Ignora ?query e #hash. */
export function isTripsPath(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0];
  return TRIPS_ONLY_PATHS.some((base) => path === base || path.startsWith(`${base}/`));
}

/** Para onde mandar quem abre uma página só de caronas com o interruptor desligado; null se não há que redirecionar. */
export function tripsRedirectTarget(pathname: string, enabled: boolean): string | null {
  return !enabled && isTripsPath(pathname) ? TRIPS_REDIRECT_PATH : null;
}

/** Tira do menu as entradas só de caronas quando o interruptor está desligado; ligado devolve o menu completo. */
export function withoutTripsItems<T extends { href: string }>(items: T[], enabled: boolean): T[] {
  return enabled ? items : items.filter((item) => !isTripsPath(item.href));
}
