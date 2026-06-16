"use client";

import { useCallback, useRef, useState } from "react";

export interface PlaceOption {
  value: string;
  label: string;
}

export interface GooglePlaceAddress {
  formatted_address: string;
  google_place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}

interface PlacesAutocompleteResponse {
  predictions?: PlaceOption[];
}

const MIN_QUERY_LENGTH = 3;

export function useGooglePlacesAutocomplete() {
  const [options, setOptions] = useState<PlaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || query.length < MIN_QUERY_LENGTH) {
      setOptions([]);
      setLoading(false);
      return;
    }

    const requestSeq = ++requestSeqRef.current;
    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchGooglePlacePredictions(query);
        if (requestSeq !== requestSeqRef.current) return;
        setOptions(results);
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setLoading(false);
        }
      }
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

export async function fetchGooglePlaceDetails(
  placeId: string,
  fallbackLabel: string
): Promise<GooglePlaceAddress> {
  try {
    const response = await fetch(
      `/api/places/details?placeId=${encodeURIComponent(placeId)}`
    );
    if (!response.ok) {
      return toFallbackAddress(placeId, fallbackLabel);
    }

    const data = (await response.json()) as GooglePlaceAddress;
    return {
      ...data,
      formatted_address: data.formatted_address || fallbackLabel,
      google_place_id: data.google_place_id || placeId,
    };
  } catch {
    return toFallbackAddress(placeId, fallbackLabel);
  }
}

async function fetchGooglePlacePredictions(query: string): Promise<PlaceOption[]> {
  try {
    const response = await fetch("/api/places/autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: query }),
    });
    if (!response.ok) return [];

    const data = (await response.json()) as PlacesAutocompleteResponse;
    return Array.isArray(data.predictions) ? data.predictions : [];
  } catch {
    return [];
  }
}

function toFallbackAddress(
  placeId: string,
  fallbackLabel: string
): GooglePlaceAddress {
  return {
    formatted_address: fallbackLabel,
    google_place_id: placeId,
  };
}
