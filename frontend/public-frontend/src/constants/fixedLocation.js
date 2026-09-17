export const DEFAULT_MAP_CENTER = {
  label: "Default Area",
  latitude: 19.965722,
  longitude: 73.668167,
};

export const DEFAULT_MAP_CENTER_COORDS = [
  DEFAULT_MAP_CENTER.latitude,
  DEFAULT_MAP_CENTER.longitude,
];

// Retained for fallback compatibility
export const FIXED_LOCATION = DEFAULT_MAP_CENTER;
export const FIXED_LOCATION_COORDS = DEFAULT_MAP_CENTER_COORDS;

export const buildMapsDirectionUrl = (
  destinationLatitude,
  destinationLongitude,
  originLatitude,
  originLongitude
) => {
  const destLat = Number(destinationLatitude);
  const destLng = Number(destinationLongitude);

  if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
    return "";
  }

  const originLat = Number(originLatitude);
  const originLng = Number(originLongitude);

  const originParam =
    Number.isFinite(originLat) && Number.isFinite(originLng)
      ? `&origin=${originLat},${originLng}`
      : "";

  return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destLat},${destLng}`;
};


