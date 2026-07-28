import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export const BOT_ACCOUNTS = {
  bot1: {
    id: '0145771d-5359-4efe-b6d0-4db7f44db573',
    email: 'ai.donor@veno.test',
    name: 'AI Donor Bot 1',
    phone: '+8801700000003',
    coords: 'POINT(90.4025 23.7940)',
    lat: 23.7940,
    lng: 90.4025,
  },
  bot2: {
    id: 'fbf45d0b-c7e9-4992-b3ea-3ab2a1757377',
    email: 'ai.donor.2@veno.test',
    name: 'AI Donor Bot 2',
    phone: '+8801700000004',
    coords: 'POINT(90.4060 23.7930)',
    lat: 23.7930,
    lng: 90.4060,
  },
  bot3: {
    id: 'b7bd584f-2ea4-4a5c-b1a8-f911fa303631',
    email: 'ai.donor.3@veno.test',
    name: 'AI Donor Bot 3',
    phone: '+8801700000005',
    coords: 'POINT(90.4120 23.7915)',
    lat: 23.7915,
    lng: 90.4120,
  },
};

export const BOT_ROUTE_COORDINATES = [
  { lat: 23.7940, lng: 90.4025, heading: 90, speed: 6 },
  { lat: 23.7938, lng: 90.4040, heading: 90, speed: 7 },
  { lat: 23.7936, lng: 90.4055, heading: 90, speed: 8 },
  { lat: 23.7934, lng: 90.4070, heading: 95, speed: 8 },
  { lat: 23.7932, lng: 90.4085, heading: 95, speed: 7 },
  { lat: 23.7930, lng: 90.4100, heading: 100, speed: 6 },
  { lat: 23.7929, lng: 90.4115, heading: 100, speed: 7 },
  { lat: 23.7928, lng: 90.4130, heading: 100, speed: 8 },
  { lat: 23.7927, lng: 90.4140, heading: 105, speed: 6 },
  { lat: 23.7926, lng: 90.4148, heading: 105, speed: 4 },
  { lat: 23.7925, lng: 90.4152, heading: 105, speed: 0 },
];

let activeGpsInterval: any = null;

async function getClientForBot(botEmail: string) {
  const client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const { data, error } = await client.auth.signInWithPassword({
    email: botEmail,
    password: 'VenoSecureTempPassword123!',
  });

  if (error) {
    throw error;
  }

  return { client, userId: data.user?.id };
}

/**
 * 1. Create a simulated active emergency blood request in Supabase
 */
export async function createBotRequest(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated.');

  // Cancel any existing active test requests for clean slate
  await supabase
    .from('blood_requests')
    .update({ status: 'CANCELLED' })
    .eq('requester_id', user.id)
    .eq('status', 'ACTIVE');

  const { data: req, error } = await supabase
    .from('blood_requests')
    .insert({
      patient_name: 'Simulated Emergency Patient',
      patient_blood_group: 'O+',
      urgency: 'CRITICAL',
      units_needed: 1,
      location_address: 'Gulshan Central Clinic',
      location_coords: 'POINT(90.4152 23.7925)',
      notes: 'Bot Simulated Blood Request for Testing',
      status: 'ACTIVE',
      requester_id: user.id,
    })
    .select()
    .single();

  if (error || !req) throw error || new Error('Failed to create test request.');

  await AsyncStorage.setItem('active_demo_request_id', req.id);
  await AsyncStorage.setItem('is_demo_active', 'true');
  DeviceEventEmitter.emit('demoStateChanged');

  return req.id;
}

/**
 * 2. Spawn bot profiles and set status to ACCEPTED / MATCHED in request_queues
 */
export async function spawnAndMatchBotDonors(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('seed_demo_bots', {
    p_request_id: requestId,
    p_action: 'JOIN_QUEUE',
  });

  if (error) {
    console.warn('RPC JOIN_QUEUE failed in botSimulator, executing fallback:', error.message);
    const botsToJoin = [BOT_ACCOUNTS.bot1, BOT_ACCOUNTS.bot2];
    for (const bot of botsToJoin) {
      await supabase.from('profiles').upsert({
        id: bot.id,
        full_name: bot.name,
        phone_number: bot.phone,
        blood_group: 'O+',
        verification_badge: true,
        role: 'VERIFIED_USER',
        date_of_birth: '1995-05-15',
        gender: 'MALE',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Gulshan',
        location_coords: bot.coords
      }, { onConflict: 'id' });

      await supabase.from('donor_statuses').upsert({
        user_id: bot.id,
        state: 'MATCHED',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      await supabase.from('request_queues').upsert({
        request_id: requestId,
        donor_id: bot.id,
        status: 'ACCEPTED',
        location_coords: bot.coords,
        joined_at: new Date().toISOString()
      }, { onConflict: 'request_id,donor_id' });
    }
  }

  DeviceEventEmitter.emit('demoStateChanged');
}

/**
 * 3. Start broadcasting live turn-by-turn GPS coordinates for Bot Donor 1
 */
export async function startBotLiveGpsStream(
  requestId: string,
  onStep?: (stepIndex: number, totalSteps: number) => void
): Promise<() => void> {
  if (activeGpsInterval) {
    clearInterval(activeGpsInterval);
    activeGpsInterval = null;
  }

  const trackingChannel = supabase.channel(`tracking:${requestId}`);

  return new Promise((resolve) => {
    trackingChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        let index = 0;

        activeGpsInterval = setInterval(async () => {
          if (index >= BOT_ROUTE_COORDINATES.length) {
            clearInterval(activeGpsInterval);
            activeGpsInterval = null;
            trackingChannel.untrack();
            trackingChannel.unsubscribe();
            return;
          }

          const step = BOT_ROUTE_COORDINATES[index];
          if (onStep) onStep(index + 1, BOT_ROUTE_COORDINATES.length);

          await trackingChannel.track({
            lat: step.lat,
            lng: step.lng,
            heading: step.heading,
            speed: step.speed,
            timestamp: Date.now(),
            userId: BOT_ACCOUNTS.bot1.id,
          });

          index++;
        }, 3000);

        resolve(stopBotLiveGpsStream);
      }
    });
  });
}

/**
 * Stop active GPS simulation interval
 */
export function stopBotLiveGpsStream() {
  if (activeGpsInterval) {
    clearInterval(activeGpsInterval);
    activeGpsInterval = null;
  }
}

/**
 * 4. Reset all bot statuses and test request data
 */
export async function resetAllBotData(currentRequestId?: string | null): Promise<void> {
  stopBotLiveGpsStream();

  try {
    let reqId = currentRequestId;
    if (!reqId) {
      reqId = await AsyncStorage.getItem('active_demo_request_id');
    }

    if (reqId) {
      await supabase
        .from('blood_requests')
        .update({ status: 'CANCELLED' })
        .eq('id', reqId);
    }

    await supabase.rpc('seed_demo_bots', {
      p_request_id: reqId || null,
      p_action: 'RESET_ALL',
    });

    await AsyncStorage.removeItem('is_demo_active');
    await AsyncStorage.removeItem('is_demo_step');
    await AsyncStorage.removeItem('active_demo_request_id');

    DeviceEventEmitter.emit('demoStateChanged');
  } catch (err) {
    console.error('Error resetting bot data:', err);
  }
}

/**
 * 5. Toggle verification badge status for testing profile states
 */
export async function toggleUserVerification(userId: string, currentBadgeState: boolean): Promise<boolean> {
  const newBadgeState = !currentBadgeState;
  const pointDelta = newBadgeState ? 100 : -100;

  const { data: profile } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .single();

  const currentPoints = profile?.points || 0;
  const newPoints = Math.max(0, currentPoints + pointDelta);

  const { error } = await supabase
    .from('profiles')
    .update({
      verification_badge: newBadgeState,
      points: newPoints,
    })
    .eq('id', userId);

  if (error) throw error;
  return newBadgeState;
}
