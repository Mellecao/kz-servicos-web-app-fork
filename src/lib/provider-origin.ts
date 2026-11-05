/**
 * Prestadores reais vs fictícios (`provider_profiles.is_demo`). Os fictícios existem
 * só para a demonstração e não podem poluir a lista sem aviso.
 *
 * Só sintaxe apagável: provider-origin.test.mjs corre este ficheiro diretamente no Node.
 */

export type ProviderOrigin = "all" | "real" | "demo";

export const PROVIDER_ORIGIN_LABELS: Record<ProviderOrigin, string> = {
  all: "Todos",
  real: "Reais",
  demo: "Demo",
};

interface MaybeDemo {
  is_demo?: boolean | null;
}

/** Só `is_demo === true` é fictício; ausente ou nulo conta como real. */
export function isDemoProvider(provider: MaybeDemo): boolean {
  return provider.is_demo === true;
}

export function filterProvidersByOrigin<T extends MaybeDemo>(
  providers: T[],
  origin: ProviderOrigin
): T[] {
  if (origin === "all") return providers;
  return providers.filter((p) => isDemoProvider(p) === (origin === "demo"));
}

export function countByOrigin(providers: MaybeDemo[]): Record<ProviderOrigin, number> {
  const demo = providers.filter(isDemoProvider).length;
  return { all: providers.length, real: providers.length - demo, demo };
}
