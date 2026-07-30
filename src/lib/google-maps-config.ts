export const SP_CAMPINAS_BOUNDS = {
  south: -23.75, // abaixo de SP capital (~Diadema/São Bernardo)
  north: -22.83, // acima de Campinas
  west: -47.20,  // oeste de Campinas
  east: -46.30,  // leste da região metropolitana de SP (Mogi, Suzano)
} as const;

// 'places' é usado pelo autocomplete de endereço em formulários admin.
export const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

// Bounds amplos que englobam TODA a região que a KZ atende: RMSP, Campinas,
// Vinhedo, Louveira, Jundiaí, Sorocaba, Vale do Paraíba, litoral (Santos etc).
// Usados como `bounds` no Places Autocomplete — priorizam resultados dessa
// área sem excluir outros do Brasil. País continua restrito a BR.
export const SERVICE_AREA_BOUNDS = {
  south: -24.2, // Santos/litoral sul
  north: -22.5, // acima de Campinas e Vinhedo
  west: -47.6,  // Sorocaba
  east: -45.5,  // Vale do Paraíba
} as const;

export function assertGoogleMapsApiKey(key: string | undefined): asserts key is string {
  if (!key || key.trim() === "") {
    throw new Error(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY não configurada. Veja .env.local.example."
    );
  }
}
