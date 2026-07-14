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
    email: 'ai.donor@veno.test',
    name: 'AI Donor Bot',
    phone: '+8801700000003',
    coords: 'POINT(90.4025 23.7940)',
    lat: 23.7940,
    lng: 90.4025
  },
  bot2: {
    id: 'fbf45d0b-c7e9-4992-b3ea-3ab2a1757377',
    email: 'ai.donor.2@veno.test',
    name: 'AI Donor Bot 2',
    phone: '+8801700000004',
    coords: 'POINT(90.4060 23.7930)',
    lat: 23.7930,
    lng: 90.4060
  },
  bot3: {
    id: 'b7bd584f-2ea4-4a5c-b1a8-f911fa303631',
    email: 'ai.donor.3@veno.test',
    name: 'AI Donor Bot 3',
    phone: '+8801700000005',
    coords: 'POINT(90.4120 23.7915)',
    lat: 23.7915,
    lng: 90.4120
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

  // Poll for matched donor in the queue automatically in Step 3
  useEffect(() => {
    let active = true;
    if (demoStep !== 3 || !requestId) return;

    const interval = setInterval(async () => {
      try {
        const { data: queue } = await supabase
          .from('request_queues')
          .select('status, profiles:donor_id (donor_statuses:donor_statuses (state))')
          .eq('request_id', requestId);

        if (!active) return;
        
        // Find if any bot status in queue has been matched
        const queueData = queue as any;
        const hasMatched = queueData?.some((q: any) => {
          const statuses = q.profiles?.donor_statuses;
          const state = Array.isArray(statuses) ? statuses[0]?.state : statuses?.state;
          return state === 'MATCHED';
        });

        if (hasMatched) {
          setDemoStep(4);
          await AsyncStorage.setItem('is_demo_step', '4');
          clearInterval(interval);
        }
      } catch (e) {
        console.warn('Error polling match status:', e);
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [demoStep, requestId]);

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
        friction: 6,
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

    const { data } = await client.auth.signInWithPassword({
      email: botEmail,
      password: 'VenoSecureTempPassword123!'
    });

    return { client, userId: data.user?.id };
  };

  // Step 1: Create request
  const handlePushRequest = async () => {
    setIsLoading(true);
    try {
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

      setRequestId(req.id);
      await AsyncStorage.setItem('active_demo_request_id', req.id);
      setDemoStep(2);
      await AsyncStorage.setItem('is_demo_step', '2');
      
      DeviceEventEmitter.emit('demoStateChanged');
      
      if (pathname !== '/request') {
        router.push('/request');
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Spawn bots
  const handleSpawnBots = async () => {
    setIsLoading(true);
    try {
      // Sign in and set bot profiles to ACTIVE
      for (const bot of Object.values(BOT_ACCOUNTS)) {
        const { client, userId } = await getClientForBot(bot.email);
        
        await client
          .from('profiles')
          .update({
            full_name: bot.name,
            location_coords: bot.coords
          })
          .eq('id', userId);

        await client
          .from('donor_statuses')
          .upsert({
            user_id: userId,
            state: 'ACTIVE',
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
      }

      setDemoStep(3);
      await AsyncStorage.setItem('is_demo_step', '3');
      DeviceEventEmitter.emit('demoStateChanged');
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Join queue
  const handleJoinQueue = async () => {
    setIsLoading(true);
    try {
      if (!requestId) return;

      // Bot 1 and Bot 2 join queue
      const botsToJoin = [BOT_ACCOUNTS.bot1, BOT_ACCOUNTS.bot2];
      
      for (const bot of botsToJoin) {
        const { client, userId } = await getClientForBot(bot.email);

        await client
          .from('request_queues')
          .upsert({
            request_id: requestId,
            donor_id: userId,
            status: 'ACCEPTED',
            location_coords: bot.coords,
            joined_at: new Date().toISOString()
          }, { onConflict: 'request_id,donor_id' });

        await client
          .from('donor_statuses')
          .update({ state: 'IN_QUEUE', updated_at: new Date().toISOString() })
          .eq('user_id', userId);
      }

      // Refresh request dashboard queue
      DeviceEventEmitter.emit('demoStateChanged');
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Track / matching completed, proceed to routing screen
  const handleGoToTracking = () => {
    if (requestId) {
      router.push(`/tracking/${requestId}`);
      setDemoStep(5);
      AsyncStorage.setItem('is_demo_step', '5');
    }
  };

  // Step 5: Simulate traveling transit
  const handleStartTransit = async () => {
    setIsLoading(true);
    try {
      if (!requestId) return;

      const { client, userId } = await getClientForBot(BOT_ACCOUNTS.bot1.email);
      const trackingChannel = client.channel(`tracking:${requestId}`);

      trackingChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (transitInterval) clearInterval(transitInterval);
          
          let index = 0;
          setTransitIndex(0);

          transitInterval = setInterval(async () => {
            if (index >= demoCoordinates.length) {
              clearInterval(transitInterval);
              transitInterval = null;
              trackingChannel.untrack();
              trackingChannel.unsubscribe();
              
              setDemoStep(6);
              await AsyncStorage.setItem('is_demo_step', '6');
              return;
            }

            const step = demoCoordinates[index];
            setTransitIndex(index + 1);

            await trackingChannel.track({
              lat: step.lat,
              lng: step.lng,
              heading: step.heading,
              speed: step.speed,
              timestamp: Date.now(),
              userId: userId
            });

            index++;
          }, 3500);
        }
      });
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 6: Complete/close demo
  const handleExitDemo = async () => {
    setIsLoading(true);
    if (transitInterval) {
      clearInterval(transitInterval);
      transitInterval = null;
    }
    
    try {
      if (requestId) {
        // Cancel request in DB
        await supabase
          .from('blood_requests')
          .update({ status: 'CANCELLED' })
          .eq('id', requestId);
      }

      // Reset bot statuses
      for (const bot of Object.values(BOT_ACCOUNTS)) {
        const { client, userId } = await getClientForBot(bot.email);
        
        await client
          .from('donor_statuses')
          .update({ state: 'NOT_A_DONOR', updated_at: new Date().toISOString() })
          .eq('user_id', userId);
      }

      await AsyncStorage.removeItem('is_demo_active');
      await AsyncStorage.removeItem('is_demo_step');
      await AsyncStorage.removeItem('active_demo_request_id');
      
      setDemoStep(1);
      setRequestId(null);
      
      DeviceEventEmitter.emit('demoStateChanged');
      
      router.push('/profile');
    } catch (e: any) {
      console.error(e);
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
      title: '2. Spawn Nearby Donors',
      desc: 'Populates 3 active available donors (gray pins) near you.',
      btnLabel: 'SPAWN BOTS',
      icon: <Users size={24} color={theme.colors.brand.default} />,
      action: handleSpawnBots
    },
    {
      title: '3. Donors Join Queue',
      desc: 'Bot 1 and Bot 2 accept your request and join the queue list (amber pins).',
      btnLabel: 'JOIN QUEUE',
      icon: <EnvelopeOpen size={24} color={theme.colors.brand.default} />,
      action: handleJoinQueue
    },
    {
      title: '4. Confirm Donor Match',
      desc: 'Go to request dashboard and click CONFIRM MATCH under AI Donor Bot (Bot 1) to match.',
      btnLabel: 'GO TO TRACKING MAP',
      icon: <Check size={24} color={theme.colors.brand.default} />,
      action: handleGoToTracking
    },
    {
      title: '5. Simulate Travel Transit',
      desc: 'Broadcasts GPS coordinates of Bot 1 moving towards you in real-time.',
      btnLabel: 'START TRAVEL TRANSIT',
      icon: <NavigationArrow size={24} color={theme.colors.brand.default} />,
      action: handleStartTransit
    },
    {
      title: '6. Arrived & Complete',
      desc: 'AI Donor arrived! Finish the demo to clean up database records.',
      btnLabel: 'FINISH & RESET DEMO',
      icon: <ShieldWarning size={24} color={theme.colors.brand.default} />,
      action: handleExitDemo
    }
  ];

  const currentStepData = stepsData[demoStep - 1];

  return (
    <Animated.View 
      style={[
        styles.overlayContainer, 
        { 
          transform: [{ scale: scaleAnim }],
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.strong,
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
            <TouchableOpacity onPress={() => setIsExpanded(false)} style={styles.closeBtn}>
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
                Simulating routing step {transitIndex}/{demoCoordinates.length}...
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
            
            {demoStep !== 4 && (
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
          style={[styles.collapsedBtn, { backgroundColor: theme.colors.brand.default }]}
          onPress={() => setIsExpanded(true)}
        >
          <Gear size={22} color="#FFF" weight="fill" />
          <View style={styles.pulseBadge}>
            <Text style={styles.badgeText}>{demoStep}</Text>
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 76,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    zIndex: 9999,
  },
  collapsedBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pulseBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
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
