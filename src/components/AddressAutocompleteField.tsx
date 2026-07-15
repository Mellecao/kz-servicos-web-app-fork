"use client";

import { useMemo, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import {
  fetchGooglePlaceDetails,
  useGooglePlacesAutocomplete,
  type GooglePlaceAddress,
} from "@/lib/google-places";

interface AddressAutocompleteFieldProps {
  label: string;
  placeholder?: string;
  value: GooglePlaceAddress | null;
  onChange: (value: GooglePlaceAddress | null) => void;
  disabled?: boolean;
}

const labelClass = "block text-sm font-body text-contrast mb-1";

export default function AddressAutocompleteField({
  label,
  placeholder = "Digite o endereco",
  value,
  onChange,
  disabled = false,
}: AddressAutocompleteFieldProps) {
  const places = useGooglePlacesAutocomplete();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>(
    value?.google_place_id ?? "",
  );

  const options = useMemo(() => {
    if (
      value?.google_place_id &&
      !places.options.some((opt) => opt.value === value.google_place_id)
    ) {
      return [
        { value: value.google_place_id, label: value.formatted_address },
        ...places.options,
      ];
    }
    return places.options;
  }, [places.options, value]);

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <SearchableSelect
            options={options}
            value={selectedPlaceId}
            loading={places.loading}
            disabled={disabled}
            placeholder={placeholder}
            onSearchChange={(query) => places.search(query)}
            onChange={async (placeId, optionLabel) => {
              setSelectedPlaceId(placeId);
              const detailed = await fetchGooglePlaceDetails(
                placeId,
                optionLabel,
              );
              onChange(detailed);
            }}
          />
        </div>
        {value && (
          <button
            type="button"
            onClick={() => {
              setSelectedPlaceId("");
              places.clear();
              onChange(null);
            }}
            disabled={disabled}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-body text-contrast hover:bg-surface-hover disabled:opacity-50"
            aria-label={`Limpar ${label}`}
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
