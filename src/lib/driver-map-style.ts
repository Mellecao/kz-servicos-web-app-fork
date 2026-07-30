import exportedStyle from "../../public/exported_style.json";

type CloudElementStyle = {
  visible?: boolean;
  fillColor?: string;
  strokeColor?: string;
  strokeWeight?: number;
  textFillColor?: string;
  textStrokeColor?: string;
};

type CloudStyleRule = {
  id: string;
  geometry?: CloudElementStyle;
  label?: CloudElementStyle;
};

type CloudMapStyle = {
  variant?: "light" | "dark";
  styles: CloudStyleRule[];
};

const FEATURE_TYPE_MAPPINGS: ReadonlyArray<readonly [string, string]> = [
  ["infrastructure.roadNetwork.road.arterial", "road.arterial"],
  ["infrastructure.roadNetwork.road.highway", "road.highway"],
  ["infrastructure.roadNetwork.road.local", "road.local"],
  ["infrastructure.roadNetwork.road", "road"],
  ["infrastructure.roadNetwork", "road"],
  ["infrastructure.railwayTrack", "transit.line"],
  ["infrastructure.transitStation", "transit.station"],
  ["infrastructure.building", "landscape.man_made"],
  ["infrastructure.businessCorridor", "landscape.man_made"],
  ["infrastructure.urbanArea", "landscape.man_made"],
  ["natural.water", "water"],
  ["natural.land", "landscape.natural"],
  ["natural", "landscape.natural"],
  ["pointOfInterest.transit.airport", "transit.station.airport"],
  ["pointOfInterest.transit", "transit.station"],
  ["pointOfInterest.emergency", "poi.medical"],
  ["pointOfInterest.entertainment", "poi.attraction"],
  ["pointOfInterest.landmark", "poi.attraction"],
  ["pointOfInterest.foodAndDrink", "poi.business"],
  ["pointOfInterest.lodging", "poi.business"],
  ["pointOfInterest.retail", "poi.business"],
  ["pointOfInterest.service", "poi.business"],
  ["pointOfInterest.other.government", "poi.government"],
  ["pointOfInterest.other.placeOfWorship", "poi.place_of_worship"],
  ["pointOfInterest.other.school", "poi.school"],
  ["pointOfInterest.recreation", "poi.park"],
  ["pointOfInterest", "poi"],
  ["political.city", "administrative.locality"],
  ["political.sublocality", "administrative.neighborhood"],
  ["political.landParcel", "administrative.land_parcel"],
  ["political", "administrative"],
];

function legacyFeatureType(cloudFeatureId: string): string | undefined {
  return FEATURE_TYPE_MAPPINGS.find(
    ([cloudId]) =>
      cloudFeatureId === cloudId || cloudFeatureId.startsWith(`${cloudId}.`)
  )?.[1];
}

function visibilityStyler(visible: boolean | undefined) {
  return visible === undefined
    ? []
    : [{ visibility: visible ? "on" : "off" }];
}

function convertGeometry(
  featureType: string,
  geometry: CloudElementStyle
): google.maps.MapTypeStyle[] {
  const styles: google.maps.MapTypeStyle[] = [];
  const geometryStylers = visibilityStyler(geometry.visible);

  if (geometryStylers.length > 0) {
    styles.push({
      featureType,
      elementType: "geometry",
      stylers: geometryStylers,
    });
  }

  if (geometry.fillColor) {
    styles.push({
      featureType,
      elementType: "geometry.fill",
      stylers: [{ color: geometry.fillColor }],
    });
  }

  if (geometry.strokeColor || geometry.strokeWeight !== undefined) {
    styles.push({
      featureType,
      elementType: "geometry.stroke",
      stylers: [
        ...(geometry.strokeColor ? [{ color: geometry.strokeColor }] : []),
        ...(geometry.strokeWeight !== undefined
          ? [{ weight: geometry.strokeWeight }]
          : []),
      ],
    });
  }

  return styles;
}

function convertLabel(
  featureType: string,
  label: CloudElementStyle
): google.maps.MapTypeStyle[] {
  const styles: google.maps.MapTypeStyle[] = [];
  const labelStylers = visibilityStyler(label.visible);

  if (labelStylers.length > 0) {
    styles.push({
      featureType,
      elementType: "labels",
      stylers: labelStylers,
    });
  }

  if (label.textFillColor) {
    styles.push({
      featureType,
      elementType: "labels.text.fill",
      stylers: [{ color: label.textFillColor }],
    });
  }

  if (label.textStrokeColor) {
    styles.push({
      featureType,
      elementType: "labels.text.stroke",
      stylers: [{ color: label.textStrokeColor }],
    });
  }

  return styles;
}

export function convertCloudMapStyle(
  cloudMapStyle: CloudMapStyle
): google.maps.MapTypeStyle[] {
  return cloudMapStyle.styles.flatMap((rule) => {
    const featureType = legacyFeatureType(rule.id);
    if (!featureType) return [];

    return [
      ...(rule.geometry
        ? convertGeometry(featureType, rule.geometry)
        : []),
      ...(rule.label ? convertLabel(featureType, rule.label) : []),
    ];
  });
}

const cloudMapStyle = exportedStyle as CloudMapStyle;

export const DRIVER_MAP_COLOR_SCHEME =
  cloudMapStyle.variant === "dark" ? "DARK" : "LIGHT";

export const DRIVER_MAP_STYLES = convertCloudMapStyle(cloudMapStyle);
