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
 * Parses PostGIS Point coordinates (object format, WKT string format, or WKB Hex format)
 * into a standard { latitude, longitude } object.
 */
export function parsePostGISPoint(coords: any): Coords | null {
  if (!coords) return null;
  
  if (typeof coords === 'object') {
    if (typeof coords.latitude === 'number' && typeof coords.longitude === 'number' && !isNaN(coords.latitude) && !isNaN(coords.longitude)) {
      return { latitude: coords.latitude, longitude: coords.longitude };
    }
    if (typeof coords.lat === 'number' && typeof coords.lng === 'number' && !isNaN(coords.lat) && !isNaN(coords.lng)) {
      return { latitude: coords.lat, longitude: coords.lng };
    }
    if (coords.type === 'Point' && Array.isArray(coords.coordinates) && coords.coordinates.length >= 2) {
      const lng = parseFloat(coords.coordinates[0]);
      const lat = parseFloat(coords.coordinates[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { longitude: lng, latitude: lat };
      }
    }
  }

  if (typeof coords === 'string') {
    const trimmed = coords.trim();
    const match = trimmed.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      const lng = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { longitude: lng, latitude: lat };
      }
    }

    // Try parsing PostGIS Hex WKB string (e.g. 0101000020E6100000...)
    if (trimmed.startsWith('01')) {
      const wkbResult = parseWKBPoint(trimmed);
      if (wkbResult) return wkbResult;
    }
  }
  return null;
}

/**
 * Parses a PostGIS WKB (Well-Known Binary) hex string into latitude and longitude
 */
function parseWKBPoint(hex: string): Coords | null {
  if (typeof hex !== 'string' || hex.length < 42) return null;
  const cleanHex = hex.trim();

  if (!cleanHex.startsWith('01')) return null;

  try {
    const isEWKB = cleanHex.substring(2, 10).toLowerCase() === '01000020';
    const xOffset = isEWKB ? 18 : 10;
    const yOffset = xOffset + 16;

    if (cleanHex.length < yOffset + 16) return null;

    const xHex = cleanHex.substring(xOffset, xOffset + 16);
    const yHex = cleanHex.substring(yOffset, yOffset + 16);

    const xBytes = new Uint8Array(8);
    const yBytes = new Uint8Array(8);

    for (let i = 0; i < 8; i++) {
      xBytes[i] = parseInt(xHex.substr(i * 2, 2), 16);
      yBytes[i] = parseInt(yHex.substr(i * 2, 2), 16);
    }

    const lng = new DataView(xBytes.buffer).getFloat64(0, true);
    const lat = new DataView(yBytes.buffer).getFloat64(0, true);

    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  } catch (e) {
    console.warn('WKB Hex parsing error:', e);
  }
  return null;
}

/**
 * Snaps/fuzzes coordinates to a grid (default 500 meters) to protect donor privacy prior to selection
 */
export function snapToGrid(latitude: number, longitude: number, gridSizeMeters = 500): Coords {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
    return { latitude: 23.8103, longitude: 90.4125 };
  }
  const latDegreeMeters = 111111; // Approx meters per degree latitude
  const latGridSizeDegrees = gridSizeMeters / latDegreeMeters;
  const snappedLat = Math.round(latitude / latGridSizeDegrees) * latGridSizeDegrees;

  const lonDegreeMeters = 111111 * Math.cos(latitude * (Math.PI / 180));
  const lonGridSizeDegrees = gridSizeMeters / lonDegreeMeters;
  const snappedLon = Math.round(longitude / lonGridSizeDegrees) * lonGridSizeDegrees;

  return { latitude: snappedLat, longitude: snappedLon };
}

/**
 * Fetches turn-by-turn road navigation polyline coordinates from Mapbox Directions API.
 * Falls back to a 2-point straight line if API fails or token is absent.
 */
export async function fetchRouteDirections(
  origin: Coords,
  destination: Coords,
  mapboxToken: string
): Promise<[number, number][]> {
  if (!origin || !destination || typeof origin.latitude !== 'number' || typeof origin.longitude !== 'number' || typeof destination.latitude !== 'number' || typeof destination.longitude !== 'number') {
    return [];
  }

  const defaultLine: [number, number][] = [
    [origin.longitude, origin.latitude],
    [destination.longitude, destination.latitude],
  ];

  if (!mapboxToken) {
    return defaultLine;
  }

  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('Mapbox directions request failed with status:', res.status);
      return defaultLine;
    }
    const data = await res.json();
    const routeCoords = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (routeCoords && Array.isArray(routeCoords) && routeCoords.length > 0) {
      return routeCoords;
    }
    return defaultLine;
  } catch (err) {
    console.warn('Failed to fetch Mapbox route directions:', err);
    return defaultLine;
  }
}

/**
 * Generates a GeoJSON Feature<Polygon> representing a circle of a given radius in km
 */
export function createGeoJSONCircle(center: { latitude: number; longitude: number }, radiusInKm: number = 10, points: number = 64) {
  const coords = [];
  const distanceX = radiusInKm / (111.32 * Math.cos((center.latitude * Math.PI) / 180));
  const distanceY = radiusInKm / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([center.longitude + x, center.latitude + y]);
  }
  coords.push(coords[0]); // Close polygon loop

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
  };
}


