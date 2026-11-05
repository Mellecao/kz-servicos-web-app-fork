"use client";

import { useCallback, useMemo, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import {
  GOOGLE_MAPS_LIBRARIES,
  assertGoogleMapsApiKey,
} from "@/lib/google-maps-config";

// Ponto inicial do pin: centro de Luanda.
const BOUNDS_CENTER: google.maps.LatLngLiteral = {
  lat: LUANDA_CENTER.latitude,
  lng: LUANDA_CENTER.longitude,
};
import {
  placeToSelectedAddress,
  type SelectedAddress,
} from "@/components/forms/AddressAutocompleteInput";
import { LUANDA_CENTER } from "@/lib/geo";

interface AddressPickOnMapModalProps {
  initialQuery: string;
  onClose: () => void;
  onConfirm: (address: SelectedAddress) => void;
}

const MODAL_MAP_STYLE: React.CSSProperties = {
  width: "100%",
  height: "420px",
  borderRadius: "8px",
};

export default function AddressPickOnMapModal({
  initialQuery,
  onClose,
  onConfirm,
}: AddressPickOnMapModalProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  assertGoogleMapsApiKey(apiKey);
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [pos, setPos] = useState<google.maps.LatLngLiteral>(BOUNDS_CENTER);
  const [resolvedLabel, setResolvedLabel] = useState<string>(
    initialQuery || "Arraste o pin para escolher o local",
  );
  const [busy, setBusy] = useState(false);
  const [resolvedAddress, setResolvedAddress] =
    useState<SelectedAddress | null>(null);

  const geocoder = useMemo(() => {
    if (!isLoaded || typeof google === "undefined") return null;
    return new google.maps.Geocoder();
  }, [isLoaded]);

  const reverseGeocode = useCallback(
    async (position: google.maps.LatLngLiteral) => {
      if (!geocoder) return;
      setBusy(true);
      try {
        const { results } = await geocoder.geocode({ location: position });
        const first = results[0];
        if (first) {
          const parsed = placeToSelectedAddress({
            formatted_address: first.formatted_address,
            place_id: first.place_id,
            address_components: first.address_components,
            geometry: { location: new google.maps.LatLng(position) },
          } as google.maps.places.PlaceResult);
          // O geocoder pode não trazer coords no place_result; fallback pro pin
          parsed.latitude = position.lat;
          parsed.longitude = position.lng;
          setResolvedAddress(parsed);
          setResolvedLabel(parsed.formatted_address);
        } else {
          setResolvedAddress({
            formatted_address: `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`,
            latitude: position.lat,
            longitude: position.lng,
          });
          setResolvedLabel(
            `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)} (sem morada)`,
          );
        }
      } catch {
        setResolvedAddress({
          formatted_address: `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`,
          latitude: position.lat,
          longitude: position.lng,
        });
        setResolvedLabel(
          `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)} (sem morada)`,
        );
      } finally {
        setBusy(false);
      }
    },
    [geocoder],
  );

  const handleDragEnd = useCallback(
    (event: google.maps.MapMouseEvent) => {
      const latLng = event.latLng;
      if (!latLng) return;
      const next = { lat: latLng.lat(), lng: latLng.lng() };
      setPos(next);
      void reverseGeocode(next);
    },
    [reverseGeocode],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-surface rounded-xl border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h3 className="text-sm font-heading font-bold text-dark">
              Escolher local no mapa
            </h3>
            <p className="text-xs text-contrast">
              Arraste o pin para o ponto exato da morada.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-contrast hover:text-dark"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={MODAL_MAP_STYLE}
              center={pos}
              zoom={15}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              <Marker
                position={pos}
                draggable
                onDragEnd={handleDragEnd}
              />
            </GoogleMap>
          ) : (
            <div style={MODAL_MAP_STYLE} className="bg-gray-100 flex items-center justify-center text-contrast">
              A carregar mapa…
            </div>
          )}

          <div className="mt-3 p-3 bg-background rounded-lg border border-border">
            <p className="text-xs text-contrast">Morada:</p>
            <p className="text-sm text-dark font-medium mt-0.5">
              {busy ? "A procurar morada..." : resolvedLabel}
            </p>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm text-dark hover:bg-surface-hover"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (resolvedAddress) {
                  onConfirm(resolvedAddress);
                } else {
                  onConfirm({
                    formatted_address: `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`,
                    latitude: pos.lat,
                    longitude: pos.lng,
                  });
                }
              }}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
            >
              Usar este local
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
