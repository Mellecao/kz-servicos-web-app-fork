"use client";

import { useCallback, useRef, useState } from "react";

export interface PlaceOption {
  value: string;
  label: string;
}

type ProviderResult = {
  lat: number;
  lng: number;
  label: string;
};

const LOCATIONIQ_ACCESS_TOKEN =
  process.env.NEXT_PUBLIC_LOCATIONIQ_ACCESS_TOKEN ??
  "pk.5fd9a8a1253d8c7e05df471f06125ce9";

const GEONAMES_USERNAME =
  process.env.NEXT_PUBLIC_GEONAMES_USERNAME ?? "melleca";

const BRAZIL_BBOX = "-73.99,-33.75,-34.79,5.27";

export function useGooglePlacesAutocomplete() {
  const [options, setOptions] = useState<PlaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || query.length < 3) {
      setOptions([]);
      setLoading(false);
      return;
    }

    const requestSeq = ++requestSeqRef.current;
    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      const results = await fetchAddressSuggestions(query);
      if (requestSeq !== requestSeqRef.current) return;
      setOptions(results.map(toPlaceOption));
      setLoading(false);
    }, 300);
  }, []);

  const clear = useCallback(() => {
    requestSeqRef.current++;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setOptions([]);
    setLoading(false);
  }, []);

  return { options, loading, search, clear };
}

async function fetchAddressSuggestions(query: string): Promise<ProviderResult[]> {
  const batches = await Promise.all([
    LOCATIONIQ_ACCESS_TOKEN
      ? fetchLocationIqSuggestions(query)
      : Promise.resolve([]),
    fetchPhotonSuggestions(query),
    GEONAMES_USERNAME ? fetchGeoNamesSuggestions(query) : Promise.resolve([]),
  ]);

  const merged = dedupeResults(batches.flat());
  if (merged.length > 0) return merged.slice(0, 8);

  return fetchNominatimSuggestions(query);
}

async function fetchLocationIqSuggestions(
  query: string
): Promise<ProviderResult[]> {
  const url = new URL("https://api.locationiq.com/v1/autocomplete");
  url.searchParams.set("key", LOCATIONIQ_ACCESS_TOKEN);
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "8");
  url.searchParams.set("dedupe", "1");
  url.searchParams.set("normalizecity", "1");
  url.searchParams.set("statecode", "1");
  url.searchParams.set("accept-language", "pt");

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map(parseLatLonDisplayName).filter(isProviderResult);
  } catch {
    return [];
  }
}

async function fetchPhotonSuggestions(query: string): Promise<ProviderResult[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "pt");
  url.searchParams.set("countrycode", "BR");
  url.searchParams.set("dedupe", "1");
  url.searchParams.set("bbox", BRAZIL_BBOX);

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.features)) return [];
    return data.features.map(parsePhotonFeature).filter(isProviderResult);
  } catch {
    return [];
  }
}

async function fetchGeoNamesSuggestions(query: string): Promise<ProviderResult[]> {
  const url = new URL("https://secure.geonames.org/searchJSON");
  url.searchParams.set("username", GEONAMES_USERNAME);
  url.searchParams.set("q", query);
  url.searchParams.set("country", "BR");
  url.searchParams.set("countryBias", "BR");
  url.searchParams.set("maxRows", "8");
  url.searchParams.set("style", "LONG");
  url.searchParams.set("lang", "pt");
  url.searchParams.set("isNameRequired", "true");

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.geonames)) return [];
    return data.geonames.map(parseGeoNamesItem).filter(isProviderResult);
  } catch {
    return [];
  }
}

async function fetchNominatimSuggestions(query: string): Promise<ProviderResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("limit", "8");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt-BR");

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "kz-servicos-web-app/1.0" },
    });
    if (!response.ok) return [];
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map(parseLatLonDisplayName).filter(isProviderResult);
  } catch {
    return [];
  }
}

function parseLatLonDisplayName(item: unknown): ProviderResult | null {
  if (!isRecord(item)) return null;
  const lat = parseNumber(item.lat);
  const lng = parseNumber(item.lon);
  const label = asString(item.display_name);
  if (lat == null || lng == null || !label) return null;
  return { lat, lng, label };
}

function parsePhotonFeature(item: unknown): ProviderResult | null {
  if (!isRecord(item) || !isRecord(item.geometry)) return null;
  const coordinates = item.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lng = parseNumber(coordinates[0]);
  const lat = parseNumber(coordinates[1]);
  if (lat == null || lng == null) return null;
  const properties = isRecord(item.properties) ? item.properties : {};
  const label = formatPhotonLabel(properties);
  if (!label) return null;
  return { lat, lng, label };
}

function parseGeoNamesItem(item: unknown): ProviderResult | null {
  if (!isRecord(item)) return null;
  const lat = parseNumber(item.lat);
  const lng = parseNumber(item.lng);
  if (lat == null || lng == null) return null;
  const label = uniqueParts([
    asString(item.name),
    asString(item.adminName2),
    asString(item.adminName1),
    asString(item.countryName),
  ]);
  if (!label) return null;
  return { lat, lng, label };
}

function formatPhotonLabel(properties: Record<string, unknown>): string {
  return uniqueParts([
    asString(properties.name),
    asString(properties.housenumber),
    asString(properties.street),
    asString(properties.district),
    asString(properties.city),
    asString(properties.state),
    asString(properties.country),
  ]);
}

function uniqueParts(parts: Array<string | null>): string {
  const seen = new Set<string>();
  return parts
    .filter((part): part is string => Boolean(part))
    .filter((part) => {
      const normalized = part.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join(", ");
}

function dedupeResults(results: ProviderResult[]): ProviderResult[] {
  const seen = new Set<string>();
  const deduped: ProviderResult[] = [];
  for (const result of results) {
    const key = [
      result.lat.toFixed(5),
      result.lng.toFixed(5),
      result.label.trim().toLowerCase(),
    ].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }
  return deduped;
}

function toPlaceOption(result: ProviderResult): PlaceOption {
  return {
    value: `osm:${result.lat},${result.lng}:${encodeURIComponent(result.label)}`,
    label: result.label,
  };
}

function isProviderResult(value: ProviderResult | null): value is ProviderResult {
  return value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
