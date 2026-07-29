"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InfoWindow } from "@react-google-maps/api";
import type { ActiveDriverLocation } from "@/lib/driver-locations";
import { formatTimeAgo } from "@/lib/time-ago";

interface DriverPopupProps {
  driver: ActiveDriverLocation;
  onClose: () => void;
}

export default function DriverPopup({ driver, onClose }: DriverPopupProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  const inTrip = driver.tripId !== null;
  const statusLabel = inTrip ? "Em corrida" : "Livre";
  const statusBg = inTrip ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700";
  const initial = driver.fullName.charAt(0).toUpperCase() || "?";

  return (
    <InfoWindow
      position={{ lat: driver.latitude, lng: driver.longitude }}
      onCloseClick={onClose}
      options={{ pixelOffset: new google.maps.Size(0, -24) }}
    >
      <div className="min-w-[220px] max-w-[280px] p-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
            {driver.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={driver.avatarUrl}
                alt={driver.fullName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-2xl font-bold text-gray-700">{initial}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{driver.fullName}</p>
            <span className={`inline-block text-xs px-2 py-0.5 rounded ${statusBg}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="text-sm text-gray-700 mb-1">
          {driver.vehicle ? (
            <>
              {driver.vehicle.brand} {driver.vehicle.model} · {driver.vehicle.licensePlate} · {driver.vehicle.color}
            </>
          ) : (
            <span className="text-gray-400 italic">Veículo não cadastrado</span>
          )}
        </div>

        <div className="text-xs text-gray-500 mb-2">
          Atualizado {formatTimeAgo(driver.updatedAt, nowMs)}
        </div>

        {inTrip && driver.tripId && (
          <Link
            href={`/viagens?openTrip=${driver.tripId}`}
            className="inline-block text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Abrir viagem →
          </Link>
        )}
      </div>
    </InfoWindow>
  );
}
