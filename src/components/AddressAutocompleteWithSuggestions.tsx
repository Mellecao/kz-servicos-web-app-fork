"use client";

import { useMemo, useRef, useState } from "react";
import SearchableSelect, {
  type SearchableSelectOption,
} from "@/components/SearchableSelect";
import {
  fetchGooglePlaceDetails,
  useGooglePlacesAutocomplete,
  type GooglePlaceAddress,
} from "@/lib/google-places";

interface Props {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (address: GooglePlaceAddress | null, rawText: string) => void;
  error?: boolean;
  homeAddress: GooglePlaceAddress | null;
  workAddress: GooglePlaceAddress | null;
  historyAddresses: GooglePlaceAddress[];
}

const labelClass = "block text-sm font-body text-contrast mb-1";

const HOME_KEY = "__home__";
const WORK_KEY = "__work__";
const HISTORY_KEY_PREFIX = "__hist_";

export default function AddressAutocompleteWithSuggestions({
  label,
  placeholder,
  value,
  onChange,
  error,
  homeAddress,
  workAddress,
  historyAddresses,
}: Props) {
  const places = useGooglePlacesAutocomplete();
  const [searchQuery, setSearchQuery] = useState("");
  const detailsSeqRef = useRef(0);

  const suggestionAddresses = useMemo(() => {
    const map = new Map<string, GooglePlaceAddress>();
    const dedupeKey = (a: GooglePlaceAddress) =>
      a.google_place_id ?? a.formatted_address;

    if (homeAddress) map.set(HOME_KEY, homeAddress);
    if (workAddress) map.set(WORK_KEY, workAddress);

    const takenKeys = new Set<string>();
    if (homeAddress) takenKeys.add(dedupeKey(homeAddress));
    if (workAddress) takenKeys.add(dedupeKey(workAddress));

    historyAddresses.forEach((addr, idx) => {
      const key = dedupeKey(addr);
      if (!key || takenKeys.has(key)) return;
      takenKeys.add(key);
      map.set(`${HISTORY_KEY_PREFIX}${idx}__`, addr);
    });

    return map;
  }, [homeAddress, workAddress, historyAddresses]);

  const options: SearchableSelectOption[] = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      return places.options;
    }
    const list: SearchableSelectOption[] = [];
    for (const [key, addr] of suggestionAddresses.entries()) {
      let display = addr.formatted_address;
      if (key === HOME_KEY) display = `🏠 Casa · ${addr.formatted_address}`;
      else if (key === WORK_KEY) display = `💼 Trabalho · ${addr.formatted_address}`;
      list.push({ value: key, label: display });
    }
    return list;
  }, [searchQuery, places.options, suggestionAddresses]);

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <SearchableSelect
        options={options}
        value={value}
        loading={places.loading}
        error={error}
        placeholder={placeholder}
        onSearchChange={(query) => {
          detailsSeqRef.current++;
          setSearchQuery(query);
          onChange(null, query);
          if (query.trim().length > 0) {
            places.search(query);
          } else {
            places.clear();
          }
        }}
        onChange={(optionValue, optionLabel) => {
          const preset = suggestionAddresses.get(optionValue);
          if (preset) {
            setSearchQuery("");
            places.clear();
            onChange(preset, preset.formatted_address);
            return;
          }
          const requestSeq = ++detailsSeqRef.current;
          onChange(
            {
              formatted_address: optionLabel,
              google_place_id: optionValue,
            },
            optionLabel,
          );
          setSearchQuery("");
          places.clear();
          fetchGooglePlaceDetails(optionValue, optionLabel).then((detailed) => {
            if (requestSeq !== detailsSeqRef.current) return;
            onChange(detailed, detailed.formatted_address);
          });
        }}
      />
    </div>
  );
}
