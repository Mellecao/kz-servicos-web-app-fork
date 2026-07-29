export const SP_CAMPINAS_BOUNDS = {
  south: -23.75, // abaixo de SP capital (~Diadema/São Bernardo)
  north: -22.83, // acima de Campinas
  west: -47.20,  // oeste de Campinas
  east: -46.30,  // leste da região metropolitana de SP (Mogi, Suzano)
} as const;

// Sem libraries extras — só Maps JS API core (redução de custo e superfície).
export const GOOGLE_MAPS_LIBRARIES: readonly ("places" | "geometry" | "drawing" | "visualization")[] = [];

export function assertGoogleMapsApiKey(key: string | undefined): asserts key is string {
  if (!key || key.trim() === "") {
    throw new Error(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY não configurada. Veja .env.local.example."
    );
  }
}
