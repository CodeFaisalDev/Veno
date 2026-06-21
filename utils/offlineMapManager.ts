import Mapbox from '@rnmapbox/maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHaversineDistance } from './geo';

const CACHE_COORDS_KEY = 'last_cached_map_coords';
const OFFLINE_PACK_NAME = 'user_location_cache';
const CACHE_DISTANCE_THRESHOLD_KM = 5.0; // Reuse cache if user is within 5km



/**
 * Caches a 20km bounding box around the user's current location.
 * Only downloads tiles if the user is further than 5km from the last cached location.
 */
export async function cacheUserLocationRegion(latitude: number, longitude: number): Promise<void> {
  try {
    console.log(`[OfflineMap] Starting dynamic 20km cache check for: lat=${latitude.toFixed(4)}, lng=${longitude.toFixed(4)}`);

    // 1. Check if we already have a cached pack
    const packs = await Mapbox.offlineManager.getPacks();
    const existingPack = packs.find(p => p.name === OFFLINE_PACK_NAME);

    // 2. Check if we can reuse the existing cache
    const lastCachedStr = await AsyncStorage.getItem(CACHE_COORDS_KEY);
    if (lastCachedStr && existingPack) {
      try {
        const { lat: lastLat, lng: lastLng } = JSON.parse(lastCachedStr);
        const distance = getHaversineDistance(latitude, longitude, lastLat, lastLng);
        
        if (distance < CACHE_DISTANCE_THRESHOLD_KM) {
          console.log(`[OfflineMap] User is within range (${distance.toFixed(2)}km < ${CACHE_DISTANCE_THRESHOLD_KM}km). Reusing existing cache.`);
          return;
        }
        console.log(`[OfflineMap] User moved ${distance.toFixed(2)}km away from last cached center. Refreshing cache...`);
      } catch (e) {
        console.warn('[OfflineMap] Failed to parse last cached coords:', e);
      }
    }

    // 3. Clean up the old pack if it exists
    if (existingPack) {
      console.log(`[OfflineMap] Deleting old pack: ${OFFLINE_PACK_NAME}`);
      try {
        await Mapbox.offlineManager.deletePack(OFFLINE_PACK_NAME);
      } catch (err) {
        console.warn('[OfflineMap] Failed to delete existing pack:', err);
      }
    }

    // 4. Calculate bounding box for 20km radius
    // At ~23.8° N latitude:
    // 1° Latitude ≈ 111 km, so 20km is ~0.18°
    // 1° Longitude ≈ 101 km, so 20km is ~0.20°
    const neLng = longitude + 0.20;
    const neLat = latitude + 0.18;
    const swLng = longitude - 0.20;
    const swLat = latitude - 0.18;

    console.log(`[OfflineMap] Initiating download of bounding box: NE=[${neLng.toFixed(4)}, ${neLat.toFixed(4)}], SW=[${swLng.toFixed(4)}, ${swLat.toFixed(4)}]`);

    // 5. Create and download new offline pack in background
    await Mapbox.offlineManager.createPack(
      {
        name: OFFLINE_PACK_NAME,
        styleURL: 'mapbox://styles/mapbox/streets-v12',
        minZoom: 11, // City/metro overview
        maxZoom: 15, // Detailed block level
        bounds: [
          [neLng, neLat], // North-East
          [swLng, swLat]  // South-West
        ],
      },
      (offlineRegion, status) => {
        // Progress callback
        if (status.percentage % 10 === 0 || status.percentage === 100) {
          console.log(`[OfflineMap] Downloading tiles: ${status.percentage}%`);
        }
      },
      (offlineRegion, err) => {
        // Error callback
        console.error('[OfflineMap] Download pack error:', err);
      }
    );

    // 6. Save new cache coordinates in storage
    await AsyncStorage.setItem(CACHE_COORDS_KEY, JSON.stringify({ lat: latitude, lng: longitude }));
    console.log('[OfflineMap] Caching complete for this region.');
  } catch (error) {
    console.error('[OfflineMap] Caching execution failed:', error);
  }
}
