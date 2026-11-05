// Zona urbana de Luanda (Ingombota, Maianga, Talatona, Kilamba, Viana, Cazenga,
// Cacuaco, Belas): enquadramento inicial do mapa de motoristas.
export const LUANDA_METRO_BOUNDS = {
  south: -9.10,
  north: -8.68,
  west: 13.05,
  east: 13.50,
} as const;

// 'places' é usado pelo autocomplete de morada em formulários admin.
export const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

// Província de Luanda e arredores. Usados como `bounds` no Places Autocomplete:
// priorizam resultados desta área sem excluir o resto de Angola. O país continua
// restrito a Angola (ANGOLA_REGION_CODE em geo.ts).
export const SERVICE_AREA_BOUNDS = {
  south: -9.40, // sul da província (Quissama/Kissama)
  north: -8.45, // norte (Bengo)
  west: 12.90,  // costa atlântica
  east: 14.10,  // interior (Icolo e Bengo)
} as const;

export function assertGoogleMapsApiKey(key: string | undefined): asserts key is string {
  if (!key || key.trim() === "") {
    throw new Error(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY não configurada. Veja .env.local.example."
    );
  }
}
