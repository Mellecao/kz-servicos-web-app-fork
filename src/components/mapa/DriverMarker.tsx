"use client";

import { OverlayView } from "@react-google-maps/api";
import type { ActiveDriverLocation } from "@/lib/driver-locations";

interface DriverMarkerProps {
  driver: ActiveDriverLocation;
  onClick: (driverProfileId: string) => void;
}

const GREEN = "#22C55E";
const BLUE = "#3B82F6";

export default function DriverMarker({ driver, onClick }: DriverMarkerProps) {
  const borderColor = driver.tripId ? BLUE : GREEN;
  const initial = driver.fullName.charAt(0).toUpperCase() || "?";

  return (
    <OverlayView
      position={{ lat: driver.latitude, lng: driver.longitude }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -(h / 2) })}
    >
      <button
        type="button"
        onClick={() => onClick(driver.driverProfileId)}
        className="w-10 h-10 rounded-full border-4 shadow-lg cursor-pointer overflow-hidden bg-gray-200 flex items-center justify-center"
        style={{ borderColor }}
        aria-label={`Motorista ${driver.fullName}`}
      >
        {driver.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={driver.avatarUrl}
            alt={driver.fullName}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="text-sm font-bold text-gray-700">{initial}</span>
        )}
      </button>
    </OverlayView>
  );
}
