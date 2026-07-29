"use client";

import { useMemo, useState } from "react";
import type { ActiveDriverLocation } from "@/lib/driver-locations";

interface DriverSearchInputProps {
  drivers: ActiveDriverLocation[];
  onSelect: (driverProfileId: string) => void;
}

export default function DriverSearchInput({ drivers, onSelect }: DriverSearchInputProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return drivers
      .filter((d) => d.fullName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [drivers, query]);

  return (
    <div className="relative w-64">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Buscar motorista por nome..."
        className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-dark placeholder-contrast focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {suggestions.map((d) => (
            <li key={d.driverProfileId}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(d.driverProfileId);
                  setQuery(d.fullName);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-dark hover:bg-surface-hover"
              >
                {d.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
