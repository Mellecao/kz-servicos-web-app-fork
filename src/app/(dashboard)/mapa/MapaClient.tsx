"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  fetchActiveDrivers,
  fetchDriverMeta,
  type ActiveDriverLocation,
} from "@/lib/driver-locations";
import {
  SP_CAMPINAS_BOUNDS,
  GOOGLE_MAPS_LIBRARIES,
  assertGoogleMapsApiKey,
} from "@/lib/google-maps-config";
import DriverMarker from "@/components/mapa/DriverMarker";
import DriverPopup from "@/components/mapa/DriverPopup";
import DriverSearchInput from "@/components/mapa/DriverSearchInput";
import ActiveDriverCounter from "@/components/mapa/ActiveDriverCounter";

const ACTIVE_WINDOW_MS = 10 * 60_000;
const EXPIRY_TICK_MS = 60_000;
const FOCUS_ZOOM = 15;

const MAP_CONTAINER_STYLE: React.CSSProperties = {
  width: "100%",
  height: "calc(100vh - 128px)",
};

export default function MapaClient() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  assertGoogleMapsApiKey(apiKey);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [drivers, setDrivers] = useState<ActiveDriverLocation[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    fetchActiveDrivers()
      .then((rows) => {
        if (!cancelled) setDrivers(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar motoristas");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime subscription
  useEffect(() => {
    const upsertDriver = async (driverProfileId: string) => {
      try {
        const meta = await fetchDriverMeta(driverProfileId);
        if (!meta) return;
        setDrivers((prev) => {
          const existing = prev.findIndex((d) => d.driverProfileId === driverProfileId);
          if (existing === -1) return [...prev, meta];
          const copy = [...prev];
          copy[existing] = meta;
          return copy;
        });
      } catch {
        // silent — próximo update tenta de novo
      }
    };

    const handler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const newRow = (payload.new ?? {}) as { driver_profile_id?: string };
      const oldRow = (payload.old ?? {}) as { driver_profile_id?: string };

      if (payload.eventType === "DELETE") {
        const id = oldRow.driver_profile_id;
        if (id) setDrivers((prev) => prev.filter((d) => d.driverProfileId !== id));
        return;
      }
      const id = newRow.driver_profile_id;
      if (id) void upsertDriver(id);
    };

    const channel = supabase
      .channel("admin-driver-locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        handler
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Timer de expiração
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - ACTIVE_WINDOW_MS;
      setDrivers((prev) =>
        prev.filter((d) => new Date(d.updatedAt).getTime() >= cutoff)
      );
    }, EXPIRY_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.driverProfileId === selectedDriverId) ?? null,
    [drivers, selectedDriverId]
  );

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    const bounds = new google.maps.LatLngBounds(
      { lat: SP_CAMPINAS_BOUNDS.south, lng: SP_CAMPINAS_BOUNDS.west },
      { lat: SP_CAMPINAS_BOUNDS.north, lng: SP_CAMPINAS_BOUNDS.east }
    );
    map.fitBounds(bounds);
  }, []);

  const onSelectFromSearch = useCallback(
    (driverProfileId: string) => {
      const d = drivers.find((x) => x.driverProfileId === driverProfileId);
      if (!d || !mapRef.current) return;
      mapRef.current.panTo({ lat: d.latitude, lng: d.longitude });
      mapRef.current.setZoom(FOCUS_ZOOM);
      setSelectedDriverId(driverProfileId);
    },
    [drivers]
  );

  if (loadError) {
    return (
      <div className="p-8 text-red-600">
        Erro ao carregar Google Maps: {loadError.message}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-dark">Mapa em tempo real</h1>
          <ActiveDriverCounter count={drivers.length} />
        </div>
        <DriverSearchInput drivers={drivers} onSelect={onSelectFromSearch} />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="rounded-lg overflow-hidden border border-border">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            onLoad={onMapLoad}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {drivers.map((d) => (
              <DriverMarker
                key={d.driverProfileId}
                driver={d}
                onClick={setSelectedDriverId}
              />
            ))}
            {selectedDriver && (
              <DriverPopup
                driver={selectedDriver}
                onClose={() => setSelectedDriverId(null)}
              />
            )}
          </GoogleMap>
        ) : (
          <div style={MAP_CONTAINER_STYLE} className="bg-gray-100 flex items-center justify-center text-contrast">
            Carregando mapa…
          </div>
        )}
      </div>
    </div>
  );
}
