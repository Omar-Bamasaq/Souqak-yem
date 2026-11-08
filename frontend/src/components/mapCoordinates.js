export function parseMapCoordinates(latitude, longitude) {
  const hasLatitude = latitude != null && String(latitude).trim() !== "";
  const hasLongitude = longitude != null && String(longitude).trim() !== "";
  if (!hasLatitude && !hasLongitude) {
    return { valid: true, lat: null, lng: null };
  }
  if (!hasLatitude || !hasLongitude) {
    return { valid: false, error: "يجب إدخال خط العرض والطول معًا." };
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { valid: false, error: "خط العرض يجب أن يكون بين -90 و90." };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { valid: false, error: "خط الطول يجب أن يكون بين -180 و180." };
  }
  return { valid: true, lat, lng };
}
