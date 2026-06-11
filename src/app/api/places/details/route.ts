import { NextRequest, NextResponse } from "next/server";

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  addressComponents?: GoogleAddressComponent[];
};

function getMapsApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    ""
  );
}

export async function GET(request: NextRequest) {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key não configurada" },
      { status: 500 }
    );
  }

  const placeId = request.nextUrl.searchParams.get("placeId")?.trim();
  if (!placeId) {
    return NextResponse.json({ error: "placeId é obrigatório" }, { status: 400 });
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,formattedAddress,location,addressComponents",
      },
    }
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "Erro ao buscar detalhes no Google Places" },
      { status: response.status }
    );
  }

  const place = (await response.json()) as GooglePlaceDetailsResponse;
  const components = place.addressComponents ?? [];

  return NextResponse.json({
    formatted_address: place.formattedAddress ?? "",
    google_place_id: place.id ?? placeId,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    street: findComponent(components, "route"),
    number: findComponent(components, "street_number"),
    neighborhood:
      findComponent(components, "sublocality") ??
      findComponent(components, "sublocality_level_1"),
    city:
      findComponent(components, "administrative_area_level_2") ??
      findComponent(components, "locality"),
    state: findComponent(components, "administrative_area_level_1", true),
    zip_code: findComponent(components, "postal_code"),
  });
}

function findComponent(
  components: GoogleAddressComponent[],
  type: string,
  short = false
): string | null {
  const component = components.find((item) => item.types?.includes(type));
  const value = short ? component?.shortText : component?.longText;
  return value?.trim() || null;
}
