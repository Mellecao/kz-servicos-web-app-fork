"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import {
  GOOGLE_MAPS_LIBRARIES,
  SERVICE_AREA_BOUNDS,
  assertGoogleMapsApiKey,
} from "@/lib/google-maps-config";
import AddressPickOnMapModal from "@/components/forms/AddressPickOnMapModal";

export interface SelectedAddress {
  formatted_address: string;
  google_place_id?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
}

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (raw: string) => void;
  onSelect: (address: SelectedAddress) => void;
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  place_id: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

function extractComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  types: string[],
): string | undefined {
  if (!components) return undefined;
  const found = components.find((c) => types.every((t) => c.types.includes(t)));
  if (found) return found.long_name;
  const fallback = components.find((c) => types.some((t) => c.types.includes(t)));
  return fallback?.long_name;
}

export function placeToSelectedAddress(
  place: google.maps.places.PlaceResult,
): SelectedAddress {
  const comps = place.address_components;
  return {
    formatted_address:
      place.formatted_address ?? place.name ?? "Endereço selecionado",
    google_place_id: place.place_id,
    street: extractComponent(comps, ["route"]),
    number: extractComponent(comps, ["street_number"]),
    neighborhood:
      extractComponent(comps, ["sublocality_level_1"]) ??
      extractComponent(comps, ["sublocality"]),
    city:
      extractComponent(comps, ["administrative_area_level_2"]) ??
      extractComponent(comps, ["locality"]),
    state: extractComponent(comps, ["administrative_area_level_1"]),
    zip_code: extractComponent(comps, ["postal_code"]),
    latitude: place.geometry?.location?.lat(),
    longitude: place.geometry?.location?.lng(),
  };
}

export default function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = "Digite o endereço...",
  className = "",
}: AddressAutocompleteInputProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  assertGoogleMapsApiKey(apiKey);
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);
  const sessionTokenRef = useRef<
    google.maps.places.AutocompleteSessionToken | null
  >(null);

  const autocompleteService = useMemo(() => {
    if (!isLoaded || typeof google === "undefined") return null;
    return new google.maps.places.AutocompleteService();
  }, [isLoaded]);

  const placesService = useMemo(() => {
    if (!isLoaded || typeof google === "undefined") return null;
    const attribution = document.createElement("div");
    return new google.maps.places.PlacesService(attribution);
  }, [isLoaded]);

  const runAutocomplete = useCallback(
    (input: string) => {
      if (!autocompleteService || input.trim().length < 3) {
        setSuggestions([]);
        return;
      }
      if (!sessionTokenRef.current) {
        sessionTokenRef.current =
          new google.maps.places.AutocompleteSessionToken();
      }
      autocompleteService.getPlacePredictions(
        {
          input,
          sessionToken: sessionTokenRef.current,
          componentRestrictions: { country: "br" },
          bounds: new google.maps.LatLngBounds(
            {
              lat: SERVICE_AREA_BOUNDS.south,
              lng: SERVICE_AREA_BOUNDS.west,
            },
            {
              lat: SERVICE_AREA_BOUNDS.north,
              lng: SERVICE_AREA_BOUNDS.east,
            },
          ),
        },
        (predictions) => {
          if (!predictions) {
            setSuggestions([]);
            return;
          }
          setSuggestions(
            predictions.slice(0, 6).map((p) => ({
              place_id: p.place_id ?? "",
              description: p.description,
              mainText: p.structured_formatting.main_text,
              secondaryText: p.structured_formatting.secondary_text ?? "",
            })),
          );
        },
      );
    },
    [autocompleteService],
  );

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runAutocomplete(value), 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, runAutocomplete]);

  const handleSelectSuggestion = useCallback(
    (suggestion: Suggestion) => {
      setIsOpen(false);
      setSuggestions([]);
      if (!placesService || !suggestion.place_id) {
        onSelect({ formatted_address: suggestion.description });
        onChange(suggestion.description);
        return;
      }
      placesService.getDetails(
        {
          placeId: suggestion.place_id,
          sessionToken: sessionTokenRef.current ?? undefined,
          fields: [
            "formatted_address",
            "name",
            "address_components",
            "geometry.location",
            "place_id",
          ],
        },
        (place, status) => {
          sessionTokenRef.current = null; // ends session; next input starts new
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !place
          ) {
            onSelect({ formatted_address: suggestion.description });
            onChange(suggestion.description);
            return;
          }
          const parsed = placeToSelectedAddress(place);
          onSelect(parsed);
          onChange(parsed.formatted_address);
        },
      );
    },
    [placesService, onChange, onSelect],
  );

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-dark placeholder-contrast outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectSuggestion(s);
                }}
                className="w-full text-left px-3 py-2 hover:bg-surface-hover"
              >
                <p className="text-sm text-dark truncate">{s.mainText}</p>
                {s.secondaryText && (
                  <p className="text-xs text-contrast truncate">
                    {s.secondaryText}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1.5">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="text-xs text-primary hover:underline"
        >
          Não achou? Escolher no mapa →
        </button>
      </div>

      {pickerOpen && (
        <AddressPickOnMapModal
          initialQuery={value}
          onClose={() => setPickerOpen(false)}
          onConfirm={(addr) => {
            onSelect(addr);
            onChange(addr.formatted_address);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
