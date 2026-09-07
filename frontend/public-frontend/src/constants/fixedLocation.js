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
  const origin =
    Number.isFinite(Number(originLatitude)) && Number.isFinite(Number(originLongitude))
      ? `${originLatitude},${originLongitude}`
      : `${DEFAULT_MAP_CENTER.latitude},${DEFAULT_MAP_CENTER.longitude}`;

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destinationLatitude},${destinationLongitude}`;
};

