import type { GooglePlaceAddress } from "@/lib/google-places";
import type { User, UserSavedAddress } from "@/types/database";

export function extractSavedAddress(
  client: User | null | undefined,
  label: "home" | "work",
): GooglePlaceAddress | null {
  const saved: UserSavedAddress | undefined = client?.user_saved_addresses?.find(
    (item) => item.label === label,
  );
  if (!saved?.addresses) return null;
  const addr = saved.addresses;
  return {
    formatted_address: addr.formatted_address,
    google_place_id: addr.google_place_id,
    latitude: addr.latitude,
    longitude: addr.longitude,
    street: addr.street,
    number: addr.number,
    neighborhood: addr.neighborhood,
    city: addr.city,
    state: addr.state,
    zip_code: addr.zip_code,
  };
}
