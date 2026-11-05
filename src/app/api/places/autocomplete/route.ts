import { NextRequest, NextResponse } from "next/server";
import {
  ANGOLA_REGION_CODE,
  LUANDA_BIAS_RADIUS_M,
  LUANDA_CENTER,
  PLACES_LANGUAGE_CODE,
} from "@/lib/geo";

type GoogleAutocompleteSuggestion = {
  placePrediction?: {
    placeId?: string;
    text?: {
      text?: string;
    };
  };
};

type GoogleAutocompleteResponse = {
  suggestions?: GoogleAutocompleteSuggestion[];
};

function getMapsApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    ""
  );
}

export async function POST(request: NextRequest) {
  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key não configurada" },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { input?: unknown };
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (input.length < 3) {
    return NextResponse.json({ predictions: [] });
  }

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: [ANGOLA_REGION_CODE],
      regionCode: ANGOLA_REGION_CODE,
      languageCode: PLACES_LANGUAGE_CODE,
      locationBias: {
        circle: { center: LUANDA_CENTER, radius: LUANDA_BIAS_RADIUS_M },
      },
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Erro ao procurar moradas no Google Places" },
      { status: response.status }
    );
  }

  const data = (await response.json()) as GoogleAutocompleteResponse;
  const predictions =
    data.suggestions
      ?.map((suggestion) => {
        const placeId = suggestion.placePrediction?.placeId;
        const label = suggestion.placePrediction?.text?.text;
        if (!placeId || !label) return null;
        return { value: placeId, label };
      })
      .filter((prediction): prediction is { value: string; label: string } =>
        Boolean(prediction)
      ) ?? [];

  return NextResponse.json({ predictions });
}
