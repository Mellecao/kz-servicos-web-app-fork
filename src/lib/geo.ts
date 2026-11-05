/** Constantes geográficas de Angola (única fonte). Usadas pelo Google Places. */

/** Códigos de região (ISO 3166-1 alpha-2) aceites pelo Places. */
export const ANGOLA_REGION_CODE = "ao";

/** Idioma das moradas devolvidas pelo Google. */
export const PLACES_LANGUAGE_CODE = "pt-PT";

/** Centro por omissão: Luanda. */
export const LUANDA_CENTER = { latitude: -8.8383, longitude: 13.2344 } as const;

/** Raio (m) do enviesamento da pesquisa para Luanda (máximo do Places: 50 000). */
export const LUANDA_BIAS_RADIUS_M = 50000;
