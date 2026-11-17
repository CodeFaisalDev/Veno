import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  DeviceEventEmitter,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { fetchRouteDirections, parsePostGISPoint, getHaversineDistance } from '../utils/geo';
import { createClient } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '../theme';
import { 
  Gear, 
  X, 
  MapPin, 
  Users, 
  EnvelopeOpen, 
  Check, 
  Play, 
  ShieldWarning, 
  NavigationArrow 
} from 'phosphor-react-native';

const { width } = Dimensions.get('window');
let transitInterval: any = null;

const BOT_ACCOUNTS = {
  bot1: {
    id: '0145771d-5359-4efe-b6d0-4db7f44db573',
    email: 'ai.donor.1@veno.test',
    name: 'Dr. Sarah Khan',
    phone: '+8801700000003',
    coords: 'POINT(90.4025 23.7940)',
    lat: 23.7940,
    lng: 90.4025,
    blood_group: 'O+',
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80',
    verified: true,
  },
  bot2: {
    id: 'fbf45d0b-c7e9-4992-b3ea-3ab2a1757377',
    email: 'ai.donor.2@veno.test',
    name: 'Tariq Rahman',
    phone: '+8801700000004',
    coords: 'POINT(90.4060 23.7930)',
    lat: 23.7930,
    lng: 90.4060,
    blood_group: 'O+',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    verified: true,
  },
  bot3: {
    id: 'b7bd584f-2ea4-4a5c-b1a8-f911fa303631',
    email: 'ai.donor.3@veno.test',
    name: 'Ayesha Chowdhury',
    phone: '+8801700000005',
    coords: 'POINT(90.4120 23.7915)',
    lat: 23.7915,
    lng: 90.4120,
    blood_group: 'O+',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    verified: false,
  },
  bot4: {
    id: 'c8be6950-3fb5-5b6d-c2b9-f022fa414742',
    email: 'ai.donor.4@veno.test',
    name: 'Tanvir Hasan',
    phone: '+8801700000006',
    coords: 'POINT(90.4180 23.7960)',
    lat: 23.7960,
    lng: 90.4180,
    blood_group: 'O+',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    verified: true,
  },
  bot5: {
    id: 'd9cf7061-4ac6-6c7e-d3ca-0133ab525853',
    email: 'ai.donor.5@veno.test',
    name: 'Nusrat Jahan',
    phone: '+8801700000007',
    coords: 'POINT(90.4220 23.7880)',
    lat: 23.7880,
    lng: 90.4220,
    blood_group: 'O+',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    verified: false,
  },
  bot6: {
    id: 'ea008172-5bd7-7d8f-e4db-1244bc636964',
    email: 'ai.donor.6@veno.test',
    name: 'Rafiqul Islam',
    phone: '+8801700000008',
    coords: 'POINT(90.3980 23.7980)',
    lat: 23.7980,
    lng: 90.3980,
    blood_group: 'O+',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    verified: true,
  },
  bot7: {
    id: 'fb119283-6ce8-8e90-f5ec-2355cd747075',
    email: 'ai.donor.7@veno.test',
    name: 'Dr. Arman Malik',
    phone: '+8801700000009',
    coords: 'POINT(90.4250 23.7950)',
    lat: 23.7950,
    lng: 90.4250,
    blood_group: 'O+',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    verified: true,
  },
  bot8: {
    id: '0c220394-7df9-9f01-06fd-3466de858186',
    email: 'ai.donor.8@veno.test',
    name: 'Farhana Ahmed',
    phone: '+8801700000010',
    coords: 'POINT(90.4090 23.8010)',
    lat: 23.8010,
    lng: 90.4090,
    blood_group: 'O+',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    verified: false,
  },
  bot9: {
    id: '1d3314a5-8ea0-0a12-17fe-4577ef969297',
    email: 'ai.donor.9@veno.test',
    name: 'Kazi Masud',
    phone: '+8801700000011',
    coords: 'POINT(90.4300 23.7850)',
    lat: 23.7850,
    lng: 90.4300,
    blood_group: 'O+',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    verified: true,
  },
  bot10: {
    id: '2e4425b6-9fb1-1b23-280f-5688f0a703a8',
    email: 'ai.donor.10@veno.test',
    name: 'Sumi Parveen',
    phone: '+8801700000012',
    coords: 'POINT(90.3920 23.7870)',
    lat: 23.7870,
    lng: 90.3920,
    blood_group: 'O+',
    avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
    verified: false,
  }
};

const demoCoordinates = [
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
  { lat: 23.7925, lng: 90.4152, heading: 105, speed: 0 }
];

function generateRoadSteps(
  roadCoords: [number, number][],
  targetSteps: number
): { lat: number; lng: number }[] {
  if (!roadCoords || roadCoords.length === 0) return [];
  if (roadCoords.length === 1) return [{ lat: roadCoords[0][1], lng: roadCoords[0][0] }];
  if (targetSteps <= 1) return [{ lat: roadCoords[0][1], lng: roadCoords[0][0] }];

  const steps: { lat: number; lng: number }[] = [];
  const totalPoints = roadCoords.length;

  for (let i = 0; i < targetSteps; i++) {
    const fraction = i / (targetSteps - 1);
    const indexFloat = fraction * (totalPoints - 1);
    const lowIdx = Math.floor(indexFloat);
    const highIdx = Math.min(totalPoints - 1, Math.ceil(indexFloat));
    const subProgress = indexFloat - lowIdx;

    const p1 = roadCoords[lowIdx];
    const p2 = roadCoords[highIdx];

    const lng = p1[0] + (p2[0] - p1[0]) * subProgress;
    const lat = p1[1] + (p2[1] - p1[1]) * subProgress;

    steps.push({ lat, lng });
  }

  return steps;
}

export default function DeveloperDemoOverlay() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [demoStep, setDemoStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [transitIndex, setTransitIndex] = useState(0);
  const [totalStepsCount, setTotalStepsCount] = useState(11);

  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkDemoState();
    
    // Listen for demo triggers from Profile tab or exit triggers
    const listener = DeviceEventEmitter.addListener('demoStateChanged', checkDemoState);
    return () => {
      listener.remove();
      if (transitInterval) clearInterval(transitInterval);
    };
  }, []);

  // Listen for confirmDonorMatched event from request.tsx to auto-advance step 4 → 5
  useEffect(() => {
    const listener = DeviceEventEmitter.addListener('confirmDonorMatched', async () => {
      console.log('[DEMO] confirmDonorMatched received — advancing to step 5');
      if (demoStep === 4) {
        setDemoStep(5);
        await AsyncStorage.setItem('is_demo_step', '5');
      }
    });
    return () => listener.remove();
  }, [demoStep]);

  const checkDemoState = async () => {
    const activeVal = await AsyncStorage.getItem('is_demo_active');
    const stepVal = await AsyncStorage.getItem('is_demo_step');
    const reqIdVal = await AsyncStorage.getItem('active_demo_request_id');

    if (activeVal === 'true') {
      setIsVisible(true);
      setDemoStep(stepVal ? parseInt(stepVal) : 1);
      setRequestId(reqIdVal);
      
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 12,
        tension: 50,
      }).start();
    } else {
      setIsVisible(false);
      setIsExpanded(false);
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      if (transitInterval) {
        clearInterval(transitInterval);
        transitInterval = null;
      }
    }
  };

  const getClientForBot = async (botEmail: string) => {
    const client = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      process.env.EXPO_PUBLIC_SUPABASE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        }
      }
    );

    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: botEmail,
      password: 'VenoSecureTempPassword123!'
    });

    if (!signInError && signInData?.user) {
      return { client, userId: signInData.user.id };
    }

    const { data: signUpData } = await client.auth.signUp({
      email: botEmail,
      password: 'VenoSecureTempPassword123!'
    });

    return { client, userId: signUpData?.user?.id };
  };

  // Step 1: Create request
  const handlePushRequest = async () => {
    setIsLoading(true);
    try {
      console.log('[DEMO] Step 1: Creating blood request...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated.');

      // Cancel previous requests
      await supabase
        .from('blood_requests')
        .update({ status: 'CANCELLED' })
        .eq('requester_id', user.id)
        .eq('status', 'ACTIVE');

      // Create new active request at Gulshan Central Clinic
      const { data: req, error } = await supabase
        .from('blood_requests')
        .insert({
          patient_name: 'Demo Patient',
          patient_blood_group: 'O+',
          urgency: 'CRITICAL',
          units_needed: 1,
          location_address: 'Gulshan Central Clinic',
          location_coords: 'POINT(90.4152 23.7925)',
          notes: 'Interactive Sandbox Demo Request',
          status: 'ACTIVE',
          requester_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[DEMO] Request created:', req.id);
      setRequestId(req.id);
      await AsyncStorage.setItem('active_demo_request_id', req.id);
      setDemoStep(2);
      await AsyncStorage.setItem('is_demo_step', '2');
      
      DeviceEventEmitter.emit('demoStateChanged');
      
      if (pathname !== '/request') {
        router.push('/request');
      }
    } catch (e: any) {
      console.error('[DEMO] Error pushing demo request:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Spawn 10 verified bots directly into DB
  const handleSpawnBots = async () => {
    setIsLoading(true);
    try {
      console.log('[DEMO] Step 2: Spawning 10 bots...');
      const { error } = await supabase.rpc('seed_demo_bots', {
        p_request_id: requestId || null,
        p_action: 'SPAWN_DONORS',
      });

      if (error) {
        console.warn('RPC seed_demo_bots failed, executing direct fallback upserts:', error.message);
        for (const bot of Object.values(BOT_ACCOUNTS)) {
          await supabase.from('profiles').upsert({
            id: bot.id,
            full_name: bot.name,
            phone_number: bot.phone,
            blood_group: 'O+',
            avatar_url: bot.avatar,
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
            state: 'ACTIVE',
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        }
      }

      // Prepare 10 bot donor objects for guaranteed local storage map rendering
      const spawnedBots = Object.values(BOT_ACCOUNTS).map(bot => ({
        id: bot.id,
        display_name: bot.name,
        blood_group: 'O+',
        avatar_url: bot.avatar,
        verification_badge: true,
        latitude: bot.lat,
        longitude: bot.lng,
      }));
      await AsyncStorage.setItem('demo_spawned_bots', JSON.stringify(spawnedBots));
      await AsyncStorage.removeItem('demo_accepted_queue');
      await AsyncStorage.setItem('is_demo_active', 'true');

      setDemoStep(3);
      await AsyncStorage.setItem('is_demo_step', '3');
      DeviceEventEmitter.emit('demoStateChanged');
    } catch (e: any) {
      console.error('Error spawning bots:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Join queue (4 bots accept the request)
  const handleJoinQueue = async () => {
    setIsLoading(true);
    try {
      if (!requestId) {
        console.warn('[DEMO] No requestId for JOIN_QUEUE');
        return;
      }
      console.log('[DEMO] Step 3: JOIN_QUEUE for request', requestId);

      const { error } = await supabase.rpc('seed_demo_bots', {
        p_request_id: requestId,
        p_action: 'JOIN_QUEUE',
      });

      if (error) {
        console.warn('[DEMO] RPC JOIN_QUEUE failed, using direct fallback:', error.message);
        const botsToJoin = [BOT_ACCOUNTS.bot1, BOT_ACCOUNTS.bot2, BOT_ACCOUNTS.bot3, BOT_ACCOUNTS.bot4];
        for (const bot of botsToJoin) {
          await supabase.from('request_queues').upsert({
            request_id: requestId,
            donor_id: bot.id,
            status: 'ACCEPTED',
            location_coords: bot.coords,
            joined_at: new Date().toISOString()
          }, { onConflict: 'request_id,donor_id' });

          await supabase.from('donor_statuses').upsert({
            user_id: bot.id,
            state: 'IN_QUEUE',
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        }
        console.log('[DEMO] Fallback upserts complete for 4 bots');
      }

      // Always save demo_accepted_queue to AsyncStorage for guaranteed UI queue rendering
      const demoQueue = [BOT_ACCOUNTS.bot1, BOT_ACCOUNTS.bot2, BOT_ACCOUNTS.bot3, BOT_ACCOUNTS.bot4].map((bot) => ({
        id: `demo-queue-${bot.id}`,
        status: 'ACCEPTED',
        donor_id: bot.id,
        joined_at: new Date().toISOString(),
        location_coords: bot.coords,
        profiles: {
          id: bot.id,
          full_name: bot.name,
          phone_number: bot.phone,
          blood_group: 'O+',
          points: 100,
          location_coords: bot.coords,
          avatar_url: bot.avatar,
          verification_badge: bot.verified,
          donor_statuses: { state: 'IN_QUEUE' }
        }
      }));
      await AsyncStorage.setItem('demo_accepted_queue', JSON.stringify(demoQueue));

      setDemoStep(4);
      await AsyncStorage.setItem('is_demo_step', '4');
      console.log('[DEMO] Step advanced to 4 — waiting for user to CONFIRM MATCH in queue cards');

      // Refresh request dashboard queue to show colored donor cards
      DeviceEventEmitter.emit('demoStateChanged');
    } catch (e: any) {
      console.error('[DEMO] Error in handleJoinQueue:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Confirm match (matches Bot 1 as confirmed donor)
  const handleConfirmMatchBot1 = async () => {
    setIsLoading(true);
    try {
      if (!requestId) {
        console.warn('[DEMO] No requestId for CONFIRM_MATCH');
        return;
      }
      console.log('[DEMO] Step 4: Confirming match for Bot 1 on request', requestId);

      const { error } = await supabase.rpc('seed_demo_bots', {
        p_request_id: requestId,
        p_action: 'MATCH_BOT_1',
      });

      if (error) {
        console.warn('[DEMO] RPC MATCH_BOT_1 failed, fallback upsert:', error.message);
        await supabase.from('donor_statuses').upsert({
          user_id: BOT_ACCOUNTS.bot1.id,
          state: 'MATCHED',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        await supabase.from('request_queues').update({ status: 'DECLINED' })
          .eq('request_id', requestId)
          .neq('donor_id', BOT_ACCOUNTS.bot1.id);
      }

      // Update demo_accepted_queue in AsyncStorage so Bot 1 is MATCHED
      const matchedDemoQueue = [BOT_ACCOUNTS.bot1].map((bot) => ({
        id: `demo-queue-${bot.id}`,
        status: 'ACCEPTED',
        donor_id: bot.id,
        joined_at: new Date().toISOString(),
        location_coords: bot.coords,
        profiles: {
          id: bot.id,
          full_name: bot.name,
          phone_number: bot.phone,
          blood_group: 'O+',
          points: 100,
          location_coords: bot.coords,
          avatar_url: bot.avatar,
          verification_badge: bot.verified,
          donor_statuses: { state: 'MATCHED' }
        }
      }));
      await AsyncStorage.setItem('demo_accepted_queue', JSON.stringify(matchedDemoQueue));

      setDemoStep(5);
      await AsyncStorage.setItem('is_demo_step', '5');
      console.log('[DEMO] Step 4 complete → Advanced to step 5 (Travel Transit)');
      DeviceEventEmitter.emit('demoStateChanged');
    } catch (e: any) {
      console.error('[DEMO] Error in handleConfirmMatchBot1:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to dynamically resolve the user-confirmed matched donor ID from AsyncStorage/DB
  const getConfirmedMatchedDonorId = async (): Promise<string> => {
    try {
      const localQueueJson = await AsyncStorage.getItem('demo_accepted_queue');
      if (localQueueJson) {
        const localQueue = JSON.parse(localQueueJson);
        const matched = localQueue.find(
          (q: any) =>
            q.status === 'ACCEPTED' &&
            (q.profiles?.donor_statuses?.state === 'MATCHED' || q.donor_statuses?.state === 'MATCHED' || q.state === 'MATCHED')
        );
        if (matched) {
          const matchedId = matched.donor_id || matched.profiles?.id || matched.id;
          if (matchedId) return matchedId;
        }
      }

      // Fallback query to Supabase DB if not found in local queue
      const { data: dbMatched } = await supabase
        .from('donor_statuses')
        .select('user_id')
        .eq('state', 'MATCHED')
        .limit(1)
        .maybeSingle();

      if (dbMatched?.user_id) {
        return dbMatched.user_id;
      }
    } catch (err) {
      console.warn('[DEMO] Failed to read confirmed donor ID, using default Bot 1');
    }
    return BOT_ACCOUNTS.bot1.id;
  };

  // Step 5: Simulate traveling transit — broadcasts GPS directly via DeviceEventEmitter + Supabase Presence
  const handleStartTransit = async () => {
    setIsLoading(true);
    try {
      if (!requestId) {
        console.warn('[DEMO] No requestId for TRANSIT');
        return;
      }

      const targetDonorId = await getConfirmedMatchedDonorId();

      // Resolve starting coordinates of target donor
      let donorCoords = { latitude: 23.7940, longitude: 90.4025 };
      const botMatch = Object.values(BOT_ACCOUNTS).find((b) => b.id === targetDonorId);
      if (botMatch) {
        donorCoords = { latitude: botMatch.lat, longitude: botMatch.lng };
      }

      const destinationCoords = { latitude: 23.7925, longitude: 90.4152 }; // Gulshan Central Clinic
      const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

      // 1. Fetch real road driving polyline from Mapbox Directions API
      const roadPolyline = await fetchRouteDirections(donorCoords, destinationCoords, mapboxToken);

      // 2. Calculate dynamic steps based on actual road distance
      const roadDist = getHaversineDistance(
        donorCoords.latitude,
        donorCoords.longitude,
        destinationCoords.latitude,
        destinationCoords.longitude
      );
      const dynamicStepsCount = Math.max(4, Math.min(25, Math.round(roadDist * 3.5)));
      setTotalStepsCount(dynamicStepsCount);

      // 3. Sample dynamicStepsCount points along the actual road polyline
      const dynamicRoadSteps = generateRoadSteps(roadPolyline, dynamicStepsCount);
      console.log(`[DEMO] Dynamic road transit initialized for donor ${targetDonorId}: Distance = ${roadDist.toFixed(2)} km, Dynamic Steps = ${dynamicStepsCount}`);

      if (pathname !== '/request') {
        router.push('/request');
      }

      if (transitInterval) clearInterval(transitInterval);

      let index = 0;
      setTransitIndex(0);

      const trackingChannel = supabase.channel(`tracking:${requestId}`);
      trackingChannel.subscribe();

      transitInterval = setInterval(async () => {
        if (index >= dynamicRoadSteps.length) {
          clearInterval(transitInterval);
          transitInterval = null;
          console.log('[DEMO] Dynamic road transit complete — donor arrived! Advancing to step 6');

          setTimeout(() => {
            trackingChannel.untrack();
            trackingChannel.unsubscribe();
          }, 2000);

          setDemoStep(6);
          await AsyncStorage.setItem('is_demo_step', '6');
          return;
        }

        const step = dynamicRoadSteps[index];
        setTransitIndex(index + 1);
        console.log(`[DEMO] Road Transit step ${index + 1}/${dynamicRoadSteps.length} for donor ${targetDonorId}: lat=${step.lat}, lng=${step.lng}`);

        // 1. Emit direct local event for instant map marker update in request.tsx
        DeviceEventEmitter.emit('demoBotLocationUpdate', {
          userId: targetDonorId,
          latitude: step.lat,
          longitude: step.lng,
          heading: 90,
        });

        // 2. Track via Supabase Presence if channel connected
        try {
          await trackingChannel.track({
            lat: step.lat,
            lng: step.lng,
            timestamp: Date.now(),
            userId: targetDonorId,
          });
        } catch (e) {
          // Ignore presence track errors in local fallback
        }

        index++;
      }, 2200);
    } catch (e: any) {
      console.error('[DEMO] Error in handleStartTransit:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 6: Complete Donation — marks request FULFILLED, donor cooldown, donation record, then reset
  const handleCompleteDonation = async () => {
    setIsLoading(true);
    if (transitInterval) {
      clearInterval(transitInterval);
      transitInterval = null;
    }
    
    try {
      const targetDonorId = await getConfirmedMatchedDonorId();
      console.log('[DEMO] Step 6: Completing donation for request', requestId, 'Confirmed Donor:', targetDonorId);

      if (requestId) {
        // 1. Mark request as COMPLETED (fulfilled)
        await supabase
          .from('blood_requests')
          .update({ status: 'COMPLETED' })
          .eq('id', requestId);
        console.log('[DEMO] Request marked as COMPLETED');

        // 2. Put matched donor into cooldown
        const cooldownDate = new Date();
        cooldownDate.setDate(cooldownDate.getDate() + 120);
        await supabase
          .from('donor_statuses')
          .update({
            state: 'COOLDOWN',
            donation_cooldown_until: cooldownDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', targetDonorId);
        console.log(`[DEMO] Matched donor ${targetDonorId} set to COOLDOWN`);

        // 3. Insert donation history record
        await supabase.from('donations_history').insert({
          donor_id: targetDonorId,
          request_id: requestId,
          location: 'Gulshan Central Clinic',
          points_earned: 100,
        });
        console.log('[DEMO] Donation history recorded');

        // 4. Reset remaining bots to NOT_A_DONOR
        const { error: resetErr } = await supabase.rpc('seed_demo_bots', {
          p_request_id: requestId,
          p_action: 'RESET_ALL',
        });
        if (resetErr) {
          console.warn('[DEMO] RPC RESET_ALL failed, manual cleanup:', resetErr.message);
          // Manual fallback: reset all bot donor_statuses
          for (const bot of Object.values(BOT_ACCOUNTS)) {
            await supabase.from('donor_statuses').upsert({
              user_id: bot.id,
              state: 'NOT_A_DONOR',
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
          }
          // Delete queue entries
          await supabase.from('request_queues').delete().eq('request_id', requestId);
        }
      }

      // 5. Clean up AsyncStorage
      await AsyncStorage.removeItem('is_demo_active');
      await AsyncStorage.removeItem('is_demo_step');
      await AsyncStorage.removeItem('active_demo_request_id');
      await AsyncStorage.removeItem('demo_spawned_bots');
      await AsyncStorage.removeItem('demo_accepted_queue');
      
      setDemoStep(1);
      setRequestId(null);
      console.log('[DEMO] Demo fully reset — all clean');
      
      DeviceEventEmitter.emit('demoStateChanged');
      DeviceEventEmitter.emit('profileUpdated');
      
      router.push('/profile');
    } catch (e: any) {
      console.error('[DEMO] Error in handleCompleteDonation:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Emergency exit — cancel everything without completing donation
  const handleExitDemo = async () => {
    setIsLoading(true);
    if (transitInterval) {
      clearInterval(transitInterval);
      transitInterval = null;
    }
    
    try {
      console.log('[DEMO] EXIT: Cancelling demo...');
      if (requestId) {
        await supabase
          .from('blood_requests')
          .update({ status: 'CANCELLED' })
          .eq('id', requestId);

        const { error: resetErr } = await supabase.rpc('seed_demo_bots', {
          p_request_id: requestId,
          p_action: 'RESET_ALL',
        });
        if (resetErr) {
          for (const bot of Object.values(BOT_ACCOUNTS)) {
            await supabase.from('donor_statuses').upsert({
              user_id: bot.id,
              state: 'NOT_A_DONOR',
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
          }
          if (requestId) {
            await supabase.from('request_queues').delete().eq('request_id', requestId);
          }
        }
      }

      await AsyncStorage.removeItem('is_demo_active');
      await AsyncStorage.removeItem('is_demo_step');
      await AsyncStorage.removeItem('active_demo_request_id');
      await AsyncStorage.removeItem('demo_spawned_bots');
      await AsyncStorage.removeItem('demo_accepted_queue');
      
      setDemoStep(1);
      setRequestId(null);
      
      DeviceEventEmitter.emit('demoStateChanged');
      router.push('/profile');
    } catch (e: any) {
      console.error('[DEMO] Error in handleExitDemo:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  const stepsData = [
    {
      title: '1. Push Blood Request',
      desc: 'Creates a critical blood request at Gulshan Central Clinic.',
      btnLabel: 'PUSH REQUEST',
      icon: <MapPin size={24} color={theme.colors.brand.default} />,
      action: handlePushRequest
    },
    {
      title: '2. Spawn 10 Active Donors',
      desc: 'Populates 10 active donors (gray pins) across the 10km geofence map.',
      btnLabel: 'SPAWN BOTS',
      icon: <Users size={24} color={theme.colors.brand.default} />,
      action: handleSpawnBots
    },
    {
      title: '3. 4 Donors Accept & Join Queue',
      desc: '4 nearby donors accept your request & join queue (active red pins + halos).',
      btnLabel: 'JOIN QUEUE',
      icon: <EnvelopeOpen size={24} color={theme.colors.brand.default} />,
      action: handleJoinQueue
    },
    {
      title: '4. Confirm Donor Match',
      desc: 'Tap CONFIRM MATCH to select Bot 1 (or tap CONFIRM MATCH on any donor card below).',
      btnLabel: 'CONFIRM MATCH',
      icon: <Check size={24} color={theme.colors.brand.default} />,
      action: handleConfirmMatchBot1
    },
    {
      title: '5. Simulate Travel Transit',
      desc: 'Broadcasts real-time GPS telemetry — watch the donor pin move on the map below.',
      btnLabel: 'START TRAVEL',
      icon: <NavigationArrow size={24} color={theme.colors.brand.default} />,
      action: handleStartTransit
    },
    {
      title: '6. Donor Arrived — Complete',
      desc: 'Donor arrived at the clinic! Complete the donation to finalize and reset.',
      btnLabel: 'COMPLETE DONATION',
      icon: <ShieldWarning size={24} color={theme.colors.brand.default} />,
      action: handleCompleteDonation
    }
  ];

  const currentStepData = stepsData[demoStep - 1];

  return (
    <Animated.View 
      style={[
        styles.overlayContainer, 
        isExpanded ? {
          transform: [{ scale: scaleAnim }],
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.strong,
          borderWidth: 1,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 10,
          right: 16,
          bottom: Platform.OS === 'ios' ? 95 : 82,
        } : {
          transform: [{ scale: scaleAnim }],
          backgroundColor: 'transparent',
          borderWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          right: 8,
          bottom: Platform.OS === 'ios' ? 98 : 86,
        }
      ]}
    >
      {isExpanded ? (
        <View style={styles.expandedContent}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Gear size={18} color={theme.colors.brand.default} />
              <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>Developer Sandbox</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setIsExpanded(false)} 
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <X size={16} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.progressRow}>
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <View 
                key={num} 
                style={[
                  styles.progressDot, 
                  { 
                    backgroundColor: num === demoStep 
                      ? theme.colors.brand.default 
                      : num < demoStep 
                        ? theme.colors.status.active 
                        : theme.colors.border.subtle 
                  }
                ]}
              />
            ))}
          </View>

          <View style={styles.stepInfoRow}>
            <View style={[styles.stepIconContainer, { backgroundColor: theme.colors.bg.page }]}>
              {currentStepData.icon}
            </View>
            <View style={styles.stepTextContainer}>
              <Text style={[styles.stepTitle, { color: theme.colors.text.primary }]}>
                {currentStepData.title}
              </Text>
              <Text style={[styles.stepDesc, { color: theme.colors.text.secondary }]}>
                {currentStepData.desc}
              </Text>
            </View>
          </View>

          {demoStep === 5 && transitInterval && (
            <View style={styles.transitStatusRow}>
              <ActivityIndicator size="small" color={theme.colors.brand.default} />
              <Text style={[styles.transitStatusText, { color: theme.colors.text.primary }]}>
                Simulating road routing step {transitIndex}/{totalStepsCount}...
              </Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={[styles.cancelBtn, { borderColor: theme.colors.border.strong }]}
              onPress={handleExitDemo}
              disabled={isLoading}
            >
              <Text style={[styles.cancelBtnText, { color: theme.colors.status.critical }]}>EXIT DEMO</Text>
            </TouchableOpacity>
            
            {currentStepData.btnLabel !== '' && (
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: theme.colors.brand.default }]}
                onPress={currentStepData.action}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.actionBtnText}>{currentStepData.btnLabel}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.collapsedBtn}
          onPress={() => setIsExpanded(true)}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Gear size={12} color={theme.dark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)'} weight="bold" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    borderRadius: 16,
    zIndex: 9999,
  },
  collapsedBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(128, 128, 128, 0.25)',
    opacity: 0.35,
  },
  expandedContent: {
    padding: 16,
    width: width - 32,
    maxWidth: 360,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 4,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  stepIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  transitStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  transitStatusText: {
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtn: {
    flex: 1.5,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
