export const FIXED_LOCATION = {
  label: "Sandip Foundation",
  latitude: 19.965722,
  longitude: 73.668167,
};

export const FIXED_LOCATION_COORDS = [
  FIXED_LOCATION.latitude,
  FIXED_LOCATION.longitude,
];

export const buildMapsDirectionUrl = (destinationLatitude, destinationLongitude) =>
  `https://www.google.com/maps/dir/?api=1&origin=${FIXED_LOCATION.latitude},${FIXED_LOCATION.longitude}&destination=${destinationLatitude},${destinationLongitude}`;
