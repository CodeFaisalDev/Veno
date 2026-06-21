export interface Coords {
  latitude: number;
  longitude: number;
}

/**
 * Haversine formula to compute distance in kilometers between two coordinates
 */
export function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in km
}

/**
 * Parses PostGIS Point coordinates (either in object format or WKT string format)
 * into a standard { latitude, longitude } object.
 */
export function parsePostGISPoint(coords: any): Coords | null {
  if (!coords) return null;
  if (typeof coords === 'object' && coords.type === 'Point' && Array.isArray(coords.coordinates)) {
    return {
      longitude: coords.coordinates[0],
      latitude: coords.coordinates[1],
    };
  }
  if (typeof coords === 'string') {
    const match = coords.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return {
        longitude: parseFloat(match[1]),
        latitude: parseFloat(match[2]),
      };
    }
  }
  return null;
}
