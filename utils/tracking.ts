import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getHaversineDistance } from './geo';

const TRACKING_TASK_NAME = 'VENO_TRACKING';
const ASYNC_STORAGE_KEY = 'active_tracking_request_id';
const DEST_COORDS_STORAGE_KEY = 'active_tracking_dest_coords';

let lastBroadcast = { lat: 0, lng: 0, time: 0 };
let activeChannel: any = null;
let currentRequestId: string | null = null;
let lastActiveTier: 'FAR' | 'NEAR' | 'CLOSE' | null = null;

// Helper to get or initialize the Supabase Presence channel
function getOrCreateChannel(requestId: string) {
  if (activeChannel && currentRequestId === requestId) {
    return activeChannel;
  }

  if (activeChannel) {
    activeChannel.unsubscribe();
  }

  currentRequestId = requestId;
  activeChannel = supabase.channel(`tracking:${requestId}`);
  activeChannel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      console.log(`Subscribed to tracking Presence channel for request ${requestId}`);
    }
  });

  return activeChannel;
}

// Dynamically adjust tracking frequency based on distance to destination
async function updateTrackingInterval(tier: 'FAR' | 'NEAR' | 'CLOSE', requestId: string) {
  if (lastActiveTier === tier) return;
  lastActiveTier = tier;

  let interval = 30000;
  let distance = 200;
  if (tier === 'NEAR') {
    interval = 20000;
    distance = 100;
  } else if (tier === 'CLOSE') {
    interval = 10000;
    distance = 30;
  }

  console.log(`[Tracking] Changing tracking tier to ${tier}: interval=${interval}ms, distance=${distance}m`);
  try {
    await Location.startLocationUpdatesAsync(TRACKING_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: distance,
      timeInterval: interval,
      foregroundService: {
        notificationTitle: 'Veno — En Route to Donate Blood',
        notificationBody: 'Sharing your en route location to support the blood request',
        notificationColor: '#E63946',
      },
      pausesUpdatesAutomatically: true,
    });
  } catch (err) {
    console.error('[Tracking] Failed to dynamically update location updates options:', err);
  }
}

// Define the background location task
TaskManager.defineTask(TRACKING_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error.message);
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  const location = locations?.[0];
  if (!location) return;

  const { latitude: lat, longitude: lng, heading, speed } = location.coords;
  const now = Date.now();

  try {
    let requestId = currentRequestId;
    if (!requestId) {
      requestId = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
    }
    if (!requestId) return;

    // Check distance to destination to determine tracking tier
    const destCoordsStr = await AsyncStorage.getItem(DEST_COORDS_STORAGE_KEY);
    let currentTier: 'FAR' | 'NEAR' | 'CLOSE' = 'FAR';
    let minDistance = 200;
    let minInterval = 30000;

    if (destCoordsStr) {
      const dest = JSON.parse(destCoordsStr);
      const distanceKm = getHaversineDistance(lat, lng, dest.latitude, dest.longitude);
      
      if (distanceKm < 1.0) {
        currentTier = 'CLOSE';
        minDistance = 30;
        minInterval = 10000;
      } else if (distanceKm < 5.0) {
        currentTier = 'NEAR';
        minDistance = 100;
        minInterval = 20000;
      }
      
      // Update background updates dynamically if tier shifted
      await updateTrackingInterval(currentTier, requestId);
    }

    // Load throttling states and user ID from AsyncStorage
    const lastLatStr = await AsyncStorage.getItem('last_broadcast_lat');
    const lastLngStr = await AsyncStorage.getItem('last_broadcast_lng');
    const lastTimeStr = await AsyncStorage.getItem('last_broadcast_time');
    const cachedUserId = await AsyncStorage.getItem('active_tracking_user_id');

    const lastLat = lastLatStr ? parseFloat(lastLatStr) : 0;
    const lastLng = lastLngStr ? parseFloat(lastLngStr) : 0;
    const lastTime = lastTimeStr ? parseInt(lastTimeStr, 10) : 0;

    const distanceMoved = getHaversineDistance(lastLat, lastLng, lat, lng) * 1000; // in meters
    const timeSinceLast = now - lastTime;

    // Filter redundant stationary updates (must satisfy both distance and time thresholds)
    if (lastTime !== 0) {
      if (distanceMoved < minDistance) return;
      if (timeSinceLast < minInterval) return;
    }

    // Persist current coordinates immediately to throttle next ticks
    await AsyncStorage.setItem('last_broadcast_lat', lat.toString());
    await AsyncStorage.setItem('last_broadcast_lng', lng.toString());
    await AsyncStorage.setItem('last_broadcast_time', now.toString());

    const channel = getOrCreateChannel(requestId);
    if (channel) {
      let finalUserId = cachedUserId;
      if (!finalUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          finalUserId = user.id;
          await AsyncStorage.setItem('active_tracking_user_id', user.id);
        }
      }
      await channel.track({
        lat,
        lng,
        heading: heading || 0,
        speed: speed || 0,
        timestamp: now,
        userId: finalUserId || undefined,
      });
      console.log(`Broadcasted en route location to presence channel tracking:${requestId}`);
    }
  } catch (err) {
    console.error('Failed to broadcast background tracking update:', err);
  }
});

// Start live tracking and background service
export async function startLiveTracking(requestId: string, destLat?: number, destLng?: number) {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      throw new Error('Foreground location permission is required.');
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      throw new Error('Background location permission is required.');
    }

    // Save requestId and coordinates in storage for background wakeups
    await AsyncStorage.setItem(ASYNC_STORAGE_KEY, requestId);
    if (destLat !== undefined && destLng !== undefined) {
      await AsyncStorage.setItem(DEST_COORDS_STORAGE_KEY, JSON.stringify({ latitude: destLat, longitude: destLng }));
    }

    // Pre-cache user ID for background updates
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await AsyncStorage.setItem('active_tracking_user_id', user.id);
      }
    } catch (e) {
      console.warn('Could not cache user ID in startLiveTracking:', e);
    }

    // Initialize/subscribe presence channel
    getOrCreateChannel(requestId);

    const isStarted = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
    
    // Determine starting tier based on initial distance if coordinates are provided
    let startDistance = 200;
    let startInterval = 30000;
    
    if (destLat !== undefined && destLng !== undefined) {
      try {
        let initialLoc = await Location.getLastKnownPositionAsync({});
        if (!initialLoc) {
          initialLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }
        if (initialLoc) {
          const distKm = getHaversineDistance(initialLoc.coords.latitude, initialLoc.coords.longitude, destLat, destLng);
          if (distKm < 1.0) {
            lastActiveTier = 'CLOSE';
            startDistance = 30;
            startInterval = 10000;
          } else if (distKm < 5.0) {
            lastActiveTier = 'NEAR';
            startDistance = 100;
            startInterval = 20000;
          } else {
            lastActiveTier = 'FAR';
          }
        }
      } catch (e) {
        console.warn('Could not determine starting tracking tier, defaulting to FAR:', e);
      }
    }

    if (!isStarted) {
      await Location.startLocationUpdatesAsync(TRACKING_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: startDistance,
        timeInterval: startInterval,
        foregroundService: {
          notificationTitle: 'Veno — En Route to Donate Blood',
          notificationBody: 'Sharing your en route location to support the blood request',
          notificationColor: '#E63946',
        },
        pausesUpdatesAutomatically: true,
      });
      console.log(`Background location updates started for task: ${TRACKING_TASK_NAME} with interval: ${startInterval}ms`);
    }
  } catch (err) {
    console.error('Failed to start live location tracking:', err);
    throw err;
  }
}

// Stop live tracking and cleanup
export async function stopLiveTracking() {
  try {
    await AsyncStorage.removeItem(ASYNC_STORAGE_KEY);
    await AsyncStorage.removeItem(DEST_COORDS_STORAGE_KEY);
    await AsyncStorage.removeItem('active_tracking_user_id');
    await AsyncStorage.removeItem('last_broadcast_lat');
    await AsyncStorage.removeItem('last_broadcast_lng');
    await AsyncStorage.removeItem('last_broadcast_time');

    if (activeChannel) {
      activeChannel.untrack();
      activeChannel.unsubscribe();
      activeChannel = null;
    }
    currentRequestId = null;
    lastActiveTier = null;

    const isStarted = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
      console.log('Background location updates stopped.');
    }
  } catch (err) {
    console.error('Failed to stop live location tracking:', err);
  }
}
