import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
  ActivityIndicator,
  DeviceEventEmitter,
  Animated,
  Dimensions,
  Platform,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomModal from '../../components/CustomModal';
import AvatarImage from '../../components/AvatarImage';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import Mapbox from '@rnmapbox/maps';
import { parsePostGISPoint, snapToGrid, fetchRouteDirections, createGeoJSONCircle } from '../../utils/geo';
import * as Location from 'expo-location';
import {
  MapPin,
  Phone,
  WhatsappLogo,
  CheckCircle,
  WarningCircle,
  Clock,
  Sparkle,
  ArrowRight,
  User,
  Plus,
  NavigationArrow,
  XCircle,
  SealCheck,
  Target,
  CaretUp,
  CaretDown,
} from 'phosphor-react-native';
import { useTheme } from '../../theme';
import CustomLoader from '../../components/CustomLoader';
import AnimatedPressable from '../../components/AnimatedPressable';
import { useMapStatus } from '../../hooks/useMapStatus';
import AnimatedScreenWrapper from '../../components/AnimatedScreenWrapper';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
if (MAPBOX_TOKEN) {
  try {
    Mapbox.setAccessToken(MAPBOX_TOKEN);
  } catch (e) {
    console.warn('Failed to set Mapbox access token:', e);
  }
}

interface RequestDetails {
  id: string;
  patient_name: string;
  patient_blood_group: string;
  location_address: string;
  location_coords: any;
  urgency: 'LOW' | 'MEDIUM' | 'CRITICAL';
  units_needed: number;
  notes: string;
  status: string;
  created_at: string;
}

interface QueueDonor {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  donor_id: string;
  joined_at: string;
  location_coords?: any;
  profiles: {
    id: string;
    full_name: string;
    phone_number: string;
    blood_group: string;
    points: number;
    location_coords?: any;
    avatar_url?: string | null;
    verification_badge?: boolean;
    donor_statuses?: {
      state: string;
    } | {
      state: string;
    }[];
  };
}

export default function RequestDashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const isFocused = pathname === '/request';

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [currentUserCoords, setCurrentUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(null);
  const [currentUserVerificationBadge, setCurrentUserVerificationBadge] = useState<boolean>(false);

  // Data Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [activeRequest, setActiveRequest] = useState<RequestDetails | null>(null);
  const [queueDonors, setQueueDonors] = useState<QueueDonor[]>([]);
  const [liveDonorLocations, setLiveDonorLocations] = useState<Record<string, { latitude: number; longitude: number }>>({});
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeDemoDonors, setActiveDemoDonors] = useState<any[]>([]);
  const [matchedRoutePolyline, setMatchedRoutePolyline] = useState<[number, number][] | null>(null);
  const [showOnlyMatchedDonor, setShowOnlyMatchedDonor] = useState(false);
  const [animatedDonorLocations, setAnimatedDonorLocations] = useState<Record<string, { latitude: number; longitude: number }>>({});

  // Slide-up bottom sheet state & spring animation
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(sheetAnim, {
      toValue: isSheetExpanded ? 1 : 0,
      duration: 260,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start();
  }, [isSheetExpanded]);

  // Auto-expand sheet when donors arrive in queue
  useEffect(() => {
    if (queueDonors.length > 0) {
      setIsSheetExpanded(true);
    }
  }, [queueDonors.length]);

  const animFrameRef = useRef<Record<string, number>>({});
  const currentCoordsRef = useRef<Record<string, { latitude: number; longitude: number }>>({});

  const animateToLocation = (userId: string, targetLat: number, targetLng: number) => {
    const start = currentCoordsRef.current[userId] || { latitude: targetLat, longitude: targetLng };
    const startTime = Date.now();
    const duration = 2200; // Smooth 2.2s glide across 2.5s interval steps
    let lastRenderTime = 0;

    if (animFrameRef.current[userId]) {
      cancelAnimationFrame(animFrameRef.current[userId]);
    }

    const animateStep = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth easeOutQuad easing
      const ease = 1 - (1 - progress) * (1 - progress);

      const curLat = start.latitude + (targetLat - start.latitude) * ease;
      const curLng = start.longitude + (targetLng - start.longitude) * ease;

      const newCoords = { latitude: curLat, longitude: curLng };
      currentCoordsRef.current[userId] = newCoords;

      // Throttle React state updates to ~66ms (15 FPS) to prevent native Android MarkerView layout collapse/disappearance
      if (now - lastRenderTime > 66 || progress === 1) {
        lastRenderTime = now;
        setAnimatedDonorLocations((prev) => ({ ...prev, [userId]: newCoords }));
      }

      if (progress < 1) {
        animFrameRef.current[userId] = requestAnimationFrame(animateStep);
      }
    };

    animFrameRef.current[userId] = requestAnimationFrame(animateStep);
  };

  // Blinking halo animation for matched en-route donor
  const blinkAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 0.3,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Amber halo animation for standby accepted donors
  const amberBlinkAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(amberBlinkAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(amberBlinkAnim, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Custom Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    type?: 'success' | 'warning' | 'danger' | 'info' | 'question';
  }>({
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const showCustomAlert = (config: typeof modalConfig) => {
    setModalConfig(config);
    setModalVisible(true);
  };

  // Map settings
  const cameraRef = useRef<Mapbox.Camera>(null);
  const { mapEnabled } = useMapStatus(false);

  // 1. Initial Permission Check
  useEffect(() => {
    checkPermissions();
  }, []);

  // Active Donors Check (Queries active donor profiles dynamically & reads demo_spawned_bots fallback)
  useEffect(() => {
    const fetchActiveDonors = async () => {
      try {
        const active = await AsyncStorage.getItem('is_demo_active');
        if (active === 'true') {
          const localBotsJson = await AsyncStorage.getItem('demo_spawned_bots');
          const localBots = localBotsJson ? JSON.parse(localBotsJson) : [];
          console.log('[VENO] fetchActiveDonors: demo active, localBots count:', localBots.length);

          const { data: activeDonors, error } = await supabase
            .from('donor_statuses')
            .select(`
              user_id,
              profiles:user_id (
                id,
                full_name,
                blood_group,
                avatar_url,
                verification_badge,
                location_coords
              )
            `)
            .eq('state', 'ACTIVE');

          if (!error && activeDonors && activeDonors.length > 0) {
            const donorsWithCoords = activeDonors
              .map((item: any) => {
                const prof = item.profiles;
                if (!prof || !prof.location_coords) return null;
                const coords = parsePostGISPoint(prof.location_coords);
                if (!coords) return null;
                return {
                  id: prof.id,
                  display_name: prof.full_name,
                  blood_group: prof.blood_group || 'O+',
                  avatar_url: prof.avatar_url,
                  verification_badge: !!prof.verification_badge,
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                };
              })
              .filter(Boolean);

            const combinedMap = new Map();
            localBots.forEach((b: any) => combinedMap.set(b.id, b));
            donorsWithCoords.forEach((b: any) => combinedMap.set(b.id, b));
            const combined = Array.from(combinedMap.values());
            console.log('[VENO] fetchActiveDonors: DB donors:', donorsWithCoords.length, 'combined total:', combined.length);
            setActiveDemoDonors(combined);
          } else {
            console.log('[VENO] fetchActiveDonors: No DB donors, using', localBots.length, 'local bots');
            setActiveDemoDonors(localBots);
          }
        } else {
          setActiveDemoDonors([]);
        }
      } catch (e) {
        console.warn('Error reading active donors in Request dashboard:', e);
      }
    };

    fetchActiveDonors();

    const listener = DeviceEventEmitter.addListener('demoStateChanged', () => {
      console.log('[VENO] demoStateChanged event received — refreshing donors + queue');
      fetchActiveDonors();
      fetchActiveRequestAndQueue();
    });

    const locationListener = DeviceEventEmitter.addListener('demoBotLocationUpdate', ({ userId, latitude, longitude }) => {
      console.log(`[VENO] Live GPS update for ${userId}: lat=${latitude}, lng=${longitude}`);
      setLiveDonorLocations((prev) => ({
        ...prev,
        [userId]: { latitude, longitude },
      }));
      animateToLocation(userId, latitude, longitude);
    });

    return () => {
      listener.remove();
      locationListener.remove();
    };
  }, []);

  const checkPermissions = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        fetchCurrentLocation();
      } else {
        setHasPermission(false);
        setIsLoading(false);
      }
    } catch (e) {
      console.warn('Error checking foreground location permissions:', e);
      setHasPermission(false);
      setIsLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    try {
      setIsLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        fetchCurrentLocation();
      } else {
        setHasPermission(false);
        setIsLoading(false);
      }
    } catch (e) {
      showCustomAlert({
        title: 'Permission Error',
        description: 'Failed to request location permissions.',
        confirmText: 'OK',
        type: 'danger',
        onConfirm: () => setModalVisible(false),
      });
      setIsLoading(false);
    }
  };

  const fetchCurrentLocation = async () => {
    try {
      let location: Location.LocationObject | null = null;
      try {
        location = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
      } catch {
        location = null;
      }
      if (!location) {
        location = await Location.getLastKnownPositionAsync({});
      }
      if (location) {
        setCurrentUserCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (err) {
      // Fall back to last known position if active GPS fetch fails or times out
      try {
        const lastLoc = await Location.getLastKnownPositionAsync({});
        if (lastLoc) {
          setCurrentUserCoords({
            latitude: lastLoc.coords.latitude,
            longitude: lastLoc.coords.longitude,
          });
        }
      } catch (fallbackErr) {
        console.warn('GPS location retrieval error:', fallbackErr);
      }
    } finally {
      // Trigger data fetch regardless of whether GPS resolved coordinates (falls back to defaults)
      fetchActiveRequestAndQueue();
    }
  };

  // 2. Query Active Request & Match Queues
  const fetchActiveRequestAndQueue = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Fetch current user profile details
      const { data: userProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('avatar_url, verification_badge')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileErr && userProfile) {
        setCurrentUserAvatarUrl(userProfile.avatar_url);
        setCurrentUserVerificationBadge(!!userProfile.verification_badge);
      }

      // Check if user has an active blood request
      const { data: request, error: reqErr } = await supabase
        .from('blood_requests')
        .select('*')
        .eq('requester_id', user.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (reqErr) throw reqErr;

      if (!request) {
        setActiveRequest(null);
        setQueueDonors([]);
        setIsLoading(false);
        return;
      }

      setActiveRequest(request);

      // Query request queues + profiles + donor status
      await fetchQueueData(request.id);

    } catch (error: any) {
      console.error('Error fetching active request/queue:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQueueData = async (requestId: string) => {
    try {
      const { data: queueData, error: queueErr } = await supabase
        .from('request_queues')
        .select(`
          id,
          status,
          donor_id,
          joined_at,
          location_coords,
          profiles:donor_id (
            id,
            full_name,
            phone_number,
            blood_group,
            points,
            location_coords,
            avatar_url,
            verification_badge,
            donor_statuses:donor_statuses (
              state
            )
          )
        `)
        .eq('request_id', requestId)
        .neq('status', 'DECLINED');

      if (queueErr) throw queueErr;

      let finalQueue = (queueData as any[]) || [];

      // Check if demo is active and read demo_accepted_queue fallback
      const activeDemo = await AsyncStorage.getItem('is_demo_active');
      if (activeDemo === 'true') {
        const localQueueJson = await AsyncStorage.getItem('demo_accepted_queue');
        if (localQueueJson) {
          const localQueue = JSON.parse(localQueueJson);
          localQueue.forEach((lqItem: any) => {
            const existingIndex = finalQueue.findIndex((q) => q.donor_id === lqItem.donor_id);
            if (existingIndex >= 0) {
              finalQueue[existingIndex] = lqItem;
            } else {
              finalQueue.push(lqItem);
            }
          });
        }
      }

      setQueueDonors(finalQueue);
    } catch (e: any) {
      console.warn('Error querying queue data:', e.message);
    }
  };

  // 3. Setup Supabase Realtime Channels (Realtime queue updates + Presence live locations)
  useEffect(() => {
    if (!activeRequest) return;

    // A. Listen to Realtime Postgres queue changes with unique channel ID
    const queueChannelKey = `request_queues_realtime:${activeRequest.id}:${Date.now()}`;
    const queueChannel = supabase
      .channel(queueChannelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'request_queues',
          filter: `request_id=eq.${activeRequest.id}`,
        },
        () => {
          fetchQueueData(activeRequest.id);
        }
      )
      .subscribe();

    // B. Subscribe to Presence Live Geolocation tracking stream
    const trackingChannelKey = `tracking:${activeRequest.id}:${Date.now()}`;
    const trackingChannel = supabase.channel(trackingChannelKey);

    const handleSync = () => {
      const state = trackingChannel.presenceState();
      const presences = Object.values(state).flat() as any[];
      const locationsMap: Record<string, { latitude: number; longitude: number }> = {};
      
      presences.forEach((presence: any) => {
        if (presence.userId && presence.lat && presence.lng) {
          locationsMap[presence.userId] = {
            latitude: presence.lat,
            longitude: presence.lng,
          };
        }
      });
      setLiveDonorLocations(locationsMap);
    };

    trackingChannel
      .on('presence', { event: 'sync' }, handleSync)
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(trackingChannel);
    };
  }, [activeRequest?.id]);

  // Recenter map on active markers
  useEffect(() => {
    if (!isLoading && cameraRef.current) {
      const timer = setTimeout(() => {
        handleRecenterMap();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, activeRequest?.id, queueDonors.length]);

  const handleRecenterMap = () => {
    console.log('[VENO RECENTER BTN] handleRecenterMap clicked! cameraRef exists:', !!cameraRef.current);
    if (!cameraRef.current) return;

    if (activeRequest) {
      const requestCoords = parsePostGISPoint(activeRequest.location_coords);
      if (requestCoords) {
        // Collect coordinates of all accepted/matched donors in queue
        const points = [requestCoords];
        queueDonors.forEach((donor) => {
          const donorState = getDonorStateFromQueue(donor);
          if (donorState === 'ACCEPTED' || donorState === 'MATCHED') {
            const liveLocation = liveDonorLocations[donor.donor_id];
            const profileLocation = parsePostGISPoint(donor.profiles.location_coords);
            let activeCoords = liveLocation || profileLocation;
            if (activeCoords) {
              if (donorState !== 'MATCHED') {
                activeCoords = snapToGrid(activeCoords.latitude, activeCoords.longitude);
              }
              points.push(activeCoords);
            }
          }
        });

        if (points.length > 1) {
          const lats = points.map((p) => p.latitude);
          const lngs = points.map((p) => p.longitude);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);

          cameraRef.current.setCamera({
            bounds: {
              ne: [maxLng, maxLat],
              sw: [minLng, minLat],
              paddingTop: 80,
              paddingRight: 80,
              paddingBottom: 80,
              paddingLeft: 80,
            },
            animationDuration: 1000,
          });
        } else {
          cameraRef.current.setCamera({
            centerCoordinate: [requestCoords.longitude, requestCoords.latitude],
            zoomLevel: 14,
            animationDuration: 1000,
          });
        }
      }
    } else if (currentUserCoords) {
      cameraRef.current.setCamera({
        centerCoordinate: [currentUserCoords.longitude, currentUserCoords.latitude],
        zoomLevel: 14,
        animationDuration: 1000,
      });
    }
  };

  const handleFocusRequestLocation = () => {
    console.log('====================================================');
    console.log('[VENO LOCATION BTN] Button pressed!');
    console.log('[VENO LOCATION BTN] mapEnabled:', mapEnabled, '| isFocused:', isFocused);
    console.log('[VENO LOCATION BTN] cameraRef.current exists:', !!cameraRef.current);
    console.log('[VENO LOCATION BTN] activeRequest ID:', activeRequest?.id, '| Address:', activeRequest?.location_address);
    console.log('[VENO LOCATION BTN] raw location_coords:', activeRequest?.location_coords);

    const coords = activeRequest ? parsePostGISPoint(activeRequest.location_coords) : null;
    console.log('[VENO LOCATION BTN] parsed coords:', coords);

    if (!cameraRef.current) {
      console.warn('[VENO LOCATION BTN WARN] cameraRef.current is missing/null!');
      console.log('====================================================');
      return;
    }

    if (!coords) {
      console.warn('[VENO LOCATION BTN WARN] Could not parse valid coordinates from activeRequest!');
      console.log('====================================================');
      return;
    }

    console.log('[VENO LOCATION BTN SUCCESS] Executing setCamera to:', [coords.longitude, coords.latitude], 'zoomLevel: 11.8');
    try {
      cameraRef.current.setCamera({
        centerCoordinate: [coords.longitude, coords.latitude],
        zoomLevel: 11.8,
        animationDuration: 1000,
      });
      console.log('[VENO LOCATION BTN SUCCESS] setCamera completed successfully!');
    } catch (err) {
      console.error('[VENO LOCATION BTN ERROR] setCamera threw an error:', err);
    }
    console.log('====================================================');
  };

  // 4. Action Handlers (Confirm, Cancel, Complete)
  const handleConfirmDonor = async (donor: QueueDonor) => {
    showCustomAlert({
      title: 'Confirm Donor Match',
      description: `Are you sure you want to select ${donor.profiles.full_name} to fulfill your blood request? This will decline other requests and establish live routing.`,
      confirmText: 'Confirm Match',
      cancelText: 'Cancel',
      type: 'question',
      onConfirm: async () => {
        setModalVisible(false);
        setIsActionLoading(true);
        try {
          // A. Set confirmed donor state to MATCHED
          const { error: stateErr } = await supabase
            .from('donor_statuses')
            .update({ state: 'MATCHED', updated_at: new Date().toISOString() })
            .eq('user_id', donor.donor_id);

          if (stateErr) throw stateErr;

          // B. Reject other donors in the request queue by setting their status to DECLINED
          const { error: queueErr } = await supabase
            .from('request_queues')
            .update({ status: 'DECLINED' })
            .eq('request_id', activeRequest!.id)
            .neq('donor_id', donor.donor_id);

          if (queueErr) throw queueErr;

          // C. Update local demo queue in AsyncStorage so state is MATCHED immediately
          const activeDemo = await AsyncStorage.getItem('is_demo_active');
          if (activeDemo === 'true') {
            const localQueueJson = await AsyncStorage.getItem('demo_accepted_queue');
            if (localQueueJson) {
              const localQueue = JSON.parse(localQueueJson);
              const updatedQueue = localQueue.map((q: any) => {
                if (q.donor_id === donor.donor_id) {
                  return {
                    ...q,
                    status: 'ACCEPTED',
                    profiles: {
                      ...q.profiles,
                      donor_statuses: { state: 'MATCHED' }
                    }
                  };
                } else {
                  return {
                    ...q,
                    status: 'DECLINED',
                    profiles: {
                      ...q.profiles,
                      donor_statuses: { state: 'DECLINED' }
                    }
                  };
                }
              });
              await AsyncStorage.setItem('demo_accepted_queue', JSON.stringify(updatedQueue));
            }
          }

          // Trigger local state updates
          await fetchQueueData(activeRequest!.id);
          DeviceEventEmitter.emit('demoStateChanged');
          DeviceEventEmitter.emit('confirmDonorMatched');

          showCustomAlert({
            title: 'Donor Confirmed',
            description: `${donor.profiles.full_name} is now confirmed as your matching donor and is en-route.`,
            confirmText: 'OK',
            type: 'success',
            onConfirm: () => {
              setModalVisible(false);
              fetchQueueData(activeRequest!.id);
            },
          });
        } catch (err: any) {
          showCustomAlert({
            title: 'Confirm Match Failed',
            description: err.message || 'An unexpected error occurred.',
            confirmText: 'OK',
            type: 'danger',
            onConfirm: () => setModalVisible(false),
          });
        } finally {
          setIsActionLoading(false);
        }
      },
      onCancel: () => setModalVisible(false)
    });
  };

  const handleCancelRequest = async () => {
    if (!activeRequest) return;

    showCustomAlert({
      title: 'Cancel Blood Request',
      description: 'Are you sure you want to cancel this request? Any queued active matching donors will be released.',
      confirmText: 'Yes, Cancel',
      cancelText: 'No',
      type: 'danger',
      onConfirm: async () => {
        setModalVisible(false);
        setIsActionLoading(true);
        try {
          // 1. Release matched donor if any back to ACTIVE availability
          const matchedDonor = queueDonors.find((d) => getDonorStateFromQueue(d) === 'MATCHED');
          if (matchedDonor) {
            await supabase
              .from('donor_statuses')
              .update({ state: 'ACTIVE', updated_at: new Date().toISOString() })
              .eq('user_id', matchedDonor.donor_id);
          }

          // 2. Set request status to CANCELLED
          const { error: cancelErr } = await supabase
            .from('blood_requests')
            .update({ status: 'CANCELLED' })
            .eq('id', activeRequest.id);

          if (cancelErr) throw cancelErr;

          // 3. Clear queues
          await supabase
            .from('request_queues')
            .update({ status: 'DECLINED' })
            .eq('request_id', activeRequest.id);

          DeviceEventEmitter.emit('profileUpdated');
          setActiveRequest(null);
          setQueueDonors([]);

          showCustomAlert({
            title: 'Cancelled',
            description: 'Blood request cancelled successfully.',
            confirmText: 'OK',
            type: 'success',
            onConfirm: () => setModalVisible(false)
          });
        } catch (e: any) {
          showCustomAlert({
            title: 'Error',
            description: e.message || 'Failed to cancel blood request.',
            confirmText: 'OK',
            type: 'danger',
            onConfirm: () => setModalVisible(false)
          });
        } finally {
          setIsActionLoading(false);
        }
      },
      onCancel: () => setModalVisible(false)
    });
  };

  const handleCompleteRequest = async () => {
    if (!activeRequest) return;

    showCustomAlert({
      title: 'Fulfill Request',
      description: 'Confirm that you have successfully received the blood donation and want to complete this request.',
      confirmText: 'Fulfill & Complete',
      cancelText: 'Cancel',
      type: 'question',
      onConfirm: async () => {
        setModalVisible(false);
        setIsActionLoading(true);
        try {
          // 1. Check if there is a matched donor to put in cooldown and earn points
          const matchedDonor = queueDonors.find((d) => getDonorStateFromQueue(d) === 'MATCHED');
          if (matchedDonor) {
            const cooldownDate = new Date();
            cooldownDate.setDate(cooldownDate.getDate() + 120); // 120 days recovery cooldown

            await supabase
              .from('donor_statuses')
              .update({
                state: 'COOLDOWN',
                donation_cooldown_until: cooldownDate.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', matchedDonor.donor_id);

            // Add donation history entry
            await supabase.from('donations_history').insert({
              donor_id: matchedDonor.donor_id,
              request_id: activeRequest.id,
              location: activeRequest.location_address,
              points_earned: 100, // 100 reward points
            });

            // Increment profile points
            const currentPoints = matchedDonor.profiles.points || 0;
            await supabase
              .from('profiles')
              .update({ points: currentPoints + 100 })
              .eq('id', matchedDonor.donor_id);
          }

          // 2. Set request status to COMPLETED
          const { error: completeErr } = await supabase
            .from('blood_requests')
            .update({ status: 'COMPLETED' })
            .eq('id', activeRequest.id);

          if (completeErr) throw completeErr;

          DeviceEventEmitter.emit('profileUpdated');
          setActiveRequest(null);
          setQueueDonors([]);

          showCustomAlert({
            title: 'Thank You',
            description: 'Request completed. Gratitude details sent to the donor profile.',
            confirmText: 'OK',
            type: 'success',
            onConfirm: () => setModalVisible(false)
          });
        } catch (e: any) {
          showCustomAlert({
            title: 'Error',
            description: e.message || 'Failed to complete blood request.',
            confirmText: 'OK',
            type: 'danger',
            onConfirm: () => setModalVisible(false)
          });
        } finally {
          setIsActionLoading(false);
        }
      },
      onCancel: () => setModalVisible(false)
    });
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      showCustomAlert({
        title: 'Dialer Error',
        description: 'Cannot place a call from this device.',
        confirmText: 'OK',
        type: 'danger',
        onConfirm: () => setModalVisible(false)
      });
    });
  };

  const handleMessage = (phoneNumber: string, name: string) => {
    const formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Hello ${name}, I am contacting you regarding my active blood request on Veno. Thank you for volunteering!`
    );
    Linking.openURL(`whatsapp://send?phone=${formattedPhone}&text=${text}`).catch(() => {
      Linking.openURL(`sms:${phoneNumber}?body=${text}`).catch(() => {
        showCustomAlert({
          title: 'Message Error',
          description: 'Unable to launch messaging applications.',
          confirmText: 'OK',
          type: 'danger',
          onConfirm: () => setModalVisible(false)
        });
      });
    });
  };



  function getDonorStateFromQueue(donor: QueueDonor): 'PENDING' | 'ACCEPTED' | 'MATCHED' {
    if (!donor || !donor.profiles) return 'PENDING';
    const rawState = Array.isArray(donor.profiles.donor_statuses)
      ? donor.profiles.donor_statuses[0]?.state
      : donor.profiles.donor_statuses?.state;

    if (rawState === 'MATCHED') return 'MATCHED';
    if (donor.status === 'ACCEPTED') return 'ACCEPTED';
    return 'PENDING';
  }

  const styles = getStyles(theme);

  const requestCoordinates = activeRequest ? parsePostGISPoint(activeRequest.location_coords) : null;
  const matchedDonor = queueDonors.find((d) => getDonorStateFromQueue(d) === 'MATCHED');
  
  const donorAnimated = matchedDonor ? animatedDonorLocations[matchedDonor.donor_id] : null;
  const donorLive = matchedDonor ? liveDonorLocations[matchedDonor.donor_id] : null;
  const donorProfile = matchedDonor?.profiles?.location_coords ? parsePostGISPoint(matchedDonor.profiles.location_coords) : null;
  const activeMatchedDonorCoords = donorAnimated || donorLive || donorProfile;

  // Fetch road navigation directions for matched donor (ONCE when donor is matched)
  useEffect(() => {
    if (!requestCoordinates || !matchedDonor) {
      setMatchedRoutePolyline(null);
      return;
    }

    let active = true;
    const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
    const initialCoords = donorProfile || activeMatchedDonorCoords;

    if (!initialCoords) return;

    fetchRouteDirections(initialCoords, requestCoordinates, mapboxToken).then((coords) => {
      if (active) {
        setMatchedRoutePolyline(coords);
      }
    });

    return () => {
      active = false;
    };
  }, [
    matchedDonor?.donor_id,
    requestCoordinates?.latitude,
    requestCoordinates?.longitude,
  ]);

  // Dynamic route coordinates that dynamically shrink as the donor travels to the hospital
  let routeCoordinates: [number, number][] | null = null;
  if (requestCoordinates && activeMatchedDonorCoords) {
    const currentDonorPt: [number, number] = [
      activeMatchedDonorCoords.longitude,
      activeMatchedDonorCoords.latitude,
    ];

    if (matchedRoutePolyline && matchedRoutePolyline.length > 0) {
      // Find the closest point index on the polyline to the donor's current position
      let closestIdx = 0;
      let minDistance = Infinity;

      matchedRoutePolyline.forEach((pt, idx) => {
        const dx = pt[0] - currentDonorPt[0];
        const dy = pt[1] - currentDonorPt[1];
        const dist = dx * dx + dy * dy;
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      // Truncate traveled road and connect current donor location -> remaining road -> hospital!
      const remainingWaypoints = matchedRoutePolyline.slice(closestIdx + 1);
      routeCoordinates = [currentDonorPt, ...remainingWaypoints];
    } else {
      routeCoordinates = [
        currentDonorPt,
        [requestCoordinates.longitude, requestCoordinates.latitude],
      ];
    }
  }

  // Core loading display
  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <CustomLoader message="Loading Veno interactive panel..." />
      </SafeAreaView>
    );
  }

  // Location Access Prompt
  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} backgroundColor={theme.colors.bg.page} translucent={false} />
        <View style={styles.permissionWrapper}>
          <WarningCircle size={56} color={theme.colors.brand.default} weight="duotone" />
          <Text style={styles.permissionTitle}>GPS Location Required</Text>
          <Text style={styles.permissionDesc}>
            Veno matches patients and donors in real-time. Please grant location permissions to use maps and discover compatible beacons.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={handleRequestPermission}>
            <Text style={styles.permissionBtnText}>ENABLE LOCATION PERMISSIONS</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AnimatedScreenWrapper style={styles.screen} screenIndex={1}>
      <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar
        barStyle={theme.dark ? "light-content" : "dark-content"}
        backgroundColor={theme.colors.bg.page}
        translucent={false}
      />

      {/* Screen Title */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>
          {activeRequest ? 'Live Matching Queue' : 'Request Blood'}
        </Text>
        {activeRequest && (
          <View style={styles.criticalBadge}>
            <Text style={styles.criticalBadgeText}>{activeRequest.urgency}</Text>
          </View>
        )}
      </View>

      {/* Map Segment (Top 2/3 of screen) */}
      <View style={styles.mapSegment}>
        {mapEnabled && isFocused ? (
          <Mapbox.MapView 
            style={StyleSheet.absoluteFill} 
            styleURL={theme.dark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street} 
            logoEnabled={false} 
            attributionEnabled={false}
            scaleBarEnabled={false}
          >
            <Mapbox.Camera
              ref={cameraRef}
              zoomLevel={13}
              centerCoordinate={
                requestCoordinates 
                  ? [requestCoordinates.longitude, requestCoordinates.latitude] 
                  : currentUserCoords 
                  ? [currentUserCoords.longitude, currentUserCoords.latitude]
                  : [90.4125, 23.8103]
              }
            />

            {/* 10km Geofence Radius Circle around Request Location */}
            {requestCoordinates && (
              <Mapbox.ShapeSource
                id="radius10kmSource"
                shape={createGeoJSONCircle(requestCoordinates, 10)}
              >
                <Mapbox.FillLayer
                  id="radius10kmFill"
                  style={{
                    fillColor: theme.colors.brand.default,
                    fillOpacity: 0.07,
                  }}
                />
                <Mapbox.LineLayer
                  id="radius10kmOutline"
                  style={{
                    lineColor: theme.colors.brand.default,
                    lineWidth: 1.5,
                    lineDasharray: [3, 3],
                    lineOpacity: 0.6,
                  }}
                />
              </Mapbox.ShapeSource>
            )}

            {/* Requester's destination marker - Avatar or Plus icon */}
            {requestCoordinates && (
              <Mapbox.MarkerView id="destinationMarker" coordinate={[requestCoordinates.longitude, requestCoordinates.latitude]}>
                <View style={styles.destinationPinWrapper}>
                  <View style={styles.destinationPinRipple} />
                  <View style={[styles.destinationPinCircle, currentUserAvatarUrl ? { padding: 0 } : null]}>
                    {currentUserAvatarUrl ? (
                      <AvatarImage 
                        uri={currentUserAvatarUrl} 
                        size={21} 
                        borderWidth={0} 
                      />
                    ) : (
                      <Plus size={16} color="#FFF" weight="bold" />
                    )}
                  </View>
                </View>
              </Mapbox.MarkerView>
            )}

            {/* Current user location dot if no active request */}
            {!activeRequest && currentUserCoords && (
              <Mapbox.MarkerView id="currentUserDot" coordinate={[currentUserCoords.longitude, currentUserCoords.latitude]}>
                <View style={styles.gpsDotContainer}>
                  <View style={styles.gpsDotHalo} />
                  <View style={styles.gpsDotInner} />
                </View>
              </Mapbox.MarkerView>
            )}

            {/* Donor markers - Normal MapPin circles or Avatar images */}
            {activeRequest &&
              queueDonors
                .filter((donor) => {
                  if (!showOnlyMatchedDonor) return true;
                  return getDonorStateFromQueue(donor) === 'MATCHED';
                })
                .map((donor) => {
                  if (!donor || !donor.profiles) return null;
                  const donorState = getDonorStateFromQueue(donor);
                  const smoothLocation = animatedDonorLocations[donor.donor_id];
                  const liveLocation = liveDonorLocations[donor.donor_id];
                  const profileLocation = donor.profiles.location_coords
                    ? parsePostGISPoint(donor.profiles.location_coords)
                    : null;
                  
                  // Use consistent profile/live location without grid offset to prevent pin teleportation
                  const markerCoords = (donorState === 'MATCHED' && smoothLocation) ? smoothLocation : (liveLocation || profileLocation);

                  if (!markerCoords) return null;

                  // Determine pin state and visual styling:
                  // 1. MATCHED: Vibrant Green (#1F9952) + Blinking Green Halo
                  // 2. ACCEPTED (when a MATCHED donor exists): Standby Amber (#FF9500) + Pulsing Amber Halo
                  // 3. ACCEPTED (before any match): Active Red (#E63946) + Pulsing Red Halo
                  // 4. PENDING / UNACCEPTED: Dimmed Gray (#8C9099)
                  const hasMatchedDonor = !!matchedDonor;
                  let pinColor = '#8C9099'; // Dimmed Gray for un-accepted spawned bots
                  let isGrayscale = true;
                  let haloType: 'NONE' | 'RED' | 'GREEN' | 'AMBER' = 'NONE';

                  if (donorState === 'MATCHED') {
                    pinColor = theme.colors.status.active; // Vibrant Green (#1F9952)
                    isGrayscale = false;
                    haloType = 'GREEN';
                  } else if (donorState === 'ACCEPTED') {
                    if (hasMatchedDonor) {
                      pinColor = '#FF9500'; // Standby Amber/Orange (#FF9500)
                      isGrayscale = false;
                      haloType = 'AMBER';
                    } else {
                      pinColor = theme.colors.brand.default; // Active Red (#E63946)
                      isGrayscale = false;
                      haloType = 'RED';
                    }
                  }

                  return (
                    <Mapbox.MarkerView
                      key={donor.id}
                      id={`donor-${donor.id}`}
                      coordinate={[markerCoords.longitude, markerCoords.latitude]}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={styles.donorPinContainer}>
                        {haloType === 'RED' && <View style={styles.redPinHalo} />}
                        {haloType === 'AMBER' && (
                          <Animated.View
                            style={[
                              styles.amberPinHalo,
                              {
                                opacity: amberBlinkAnim,
                                transform: [
                                  {
                                    scale: amberBlinkAnim.interpolate({
                                      inputRange: [0.4, 1],
                                      outputRange: [1, 1.6],
                                    }),
                                  },
                                ],
                              },
                            ]}
                          />
                        )}
                        {haloType === 'GREEN' && (
                          <Animated.View
                            style={[
                              styles.greenPinHalo,
                              {
                                opacity: blinkAnim,
                                transform: [
                                  {
                                    scale: blinkAnim.interpolate({
                                      inputRange: [0.3, 1],
                                      outputRange: [1, 1.8],
                                    }),
                                  },
                                ],
                              },
                            ]}
                          />
                        )}
                        <View
                          style={[
                            styles.donorPinCircle,
                            {
                              backgroundColor: pinColor,
                              borderColor: isGrayscale ? '#B0B4BC' : '#FFFFFF',
                              opacity: isGrayscale ? 0.65 : 1.0,
                            },
                          ]}
                        >
                          {donor.profiles?.avatar_url ? (
                            <View style={isGrayscale ? { opacity: 0.5 } : null}>
                              <AvatarImage 
                                uri={donor.profiles.avatar_url} 
                                size={24} 
                                borderWidth={0} 
                              />
                            </View>
                          ) : (
                            <MapPin size={14} color={isGrayscale ? '#E0E2E6' : '#FFF'} weight="fill" />
                          )}
                        </View>
                      </View>
                    </Mapbox.MarkerView>
                  );
                })}

            {/* Available nearby donors (Dimmed Gray) */}
            {!showOnlyMatchedDonor &&
              activeDemoDonors
                .filter(bot => !queueDonors.some(qd => qd.donor_id === bot.id))
                .map((bot) => {
                  // Snapped to 500m grid for privacy prior to matching/joining queue!
                  const snapped = snapToGrid(bot.latitude, bot.longitude);
                  return (
                    <Mapbox.MarkerView
                      key={`bot-gray-${bot.id}`}
                      id={`bot-gray-${bot.id}`}
                      coordinate={[snapped.longitude, snapped.latitude]}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={styles.donorPinContainer}>
                        <View
                          style={[
                            styles.donorPinCircle,
                            {
                              backgroundColor: '#8C9099',
                              borderColor: '#B0B4BC',
                              opacity: 0.65,
                            },
                          ]}
                        >
                          {bot.avatar_url ? (
                            <View style={{ opacity: 0.5 }}>
                              <AvatarImage 
                                uri={bot.avatar_url} 
                                size={24} 
                                borderWidth={0} 
                              />
                            </View>
                          ) : (
                            <MapPin size={14} color="#E0E2E6" weight="fill" />
                          )}
                        </View>
                      </View>
                    </Mapbox.MarkerView>
                  );
                })}

            {/* Route Line layer to confirmed en-route donor */}
            {routeCoordinates && (
              <Mapbox.ShapeSource
                id="routeSource"
                shape={{
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: routeCoordinates,
                  },
                }}
              >
                {/* Outer route line casing */}
                <Mapbox.LineLayer
                  id="routeLineCasing"
                  style={{
                    lineColor: theme.colors.brand.default,
                    lineWidth: 6,
                    lineOpacity: 0.35,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                {/* Inner main route line */}
                <Mapbox.LineLayer
                  id="routeLineMain"
                  style={{
                    lineColor: theme.colors.brand.default,
                    lineWidth: 3.5,
                    lineOpacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </Mapbox.ShapeSource>
            )}
          </Mapbox.MapView>
        ) : !mapEnabled ? (
          <View style={styles.mapDisabledWrapper}>
            <WarningCircle size={32} color={theme.colors.text.tertiary} />
            <Text style={styles.mapDisabledText}>Interactive mapping is paused to save device resources.</Text>
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg.page, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={theme.colors.brand.default} />
          </View>
        )}

        {/* Top Filter Chip — Show En-Route Only */}
        {matchedDonor && (
          <View style={styles.topFilterChipContainer}>
            <TouchableOpacity
              style={[
                styles.topFilterChip,
                showOnlyMatchedDonor 
                  ? { backgroundColor: theme.colors.status.active } 
                  : { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.strong, borderWidth: 1 }
              ]}
              onPress={() => setShowOnlyMatchedDonor(!showOnlyMatchedDonor)}
              activeOpacity={0.8}
            >
              <Target size={14} color={showOnlyMatchedDonor ? '#FFF' : theme.colors.status.active} weight="bold" />
              <Text style={[styles.topFilterChipText, { color: showOnlyMatchedDonor ? '#FFF' : theme.colors.text.primary }]}>
                {showOnlyMatchedDonor ? 'Showing En-Route Only' : 'Show En-Route Only'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Floating Side Map Controls */}
        <View style={styles.floatControlStack}>
          {activeRequest && requestCoordinates && (
            <AnimatedPressable 
              style={[styles.floatBtn, styles.requestLocationFloatBtn]} 
              onPress={handleFocusRequestLocation}
              activeScale={0.88}
            >
              <Target size={20} color={theme.colors.brand.default} weight="bold" />
            </AnimatedPressable>
          )}

          <AnimatedPressable 
            style={styles.floatBtn} 
            onPress={handleRecenterMap} 
            activeScale={0.88}
          >
            <NavigationArrow size={20} color={theme.colors.text.primary} weight="fill" />
          </AnimatedPressable>
        </View>
      </View>

      {/* Bottom sliding responsive overlay sheet */}
      <Animated.View
        style={[
          styles.bottomSheetSegment,
          activeRequest
            ? {
                maxHeight: sheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [215, SCREEN_HEIGHT * 0.82],
                }),
              }
            : null,
        ]}
      >
        {isActionLoading ? (
          <View style={styles.actionLoaderContainer}>
            <ActivityIndicator size="small" color={theme.colors.brand.default} />
            <Text style={styles.actionLoaderText}>Syncing Veno queue updates...</Text>
          </View>
        ) : !activeRequest ? (
          // Empty State Bottom Panel
          <View style={styles.emptyPanelContent}>
            <Text style={styles.emptyPanelTitle}>No Active Blood Request</Text>
            <Text style={styles.emptyPanelDesc}>
              Alert nearby compatible active donors instantly when you or someone else needs blood.
            </Text>
            <AnimatedPressable
              style={[styles.requestCtaBtn, theme.shadows.elevation2]}
              onPress={() => router.push('/request/create')}
              activeScale={0.96}
            >
              <Plus size={18} color={theme.colors.text.onColor} weight="bold" />
              <Text style={styles.requestCtaBtnText}>REQUEST BLOOD</Text>
            </AnimatedPressable>
          </View>
        ) : (
          // Active Matching Queue Dashboard
          <View style={styles.activePanelWrapper}>
            {/* Drag handle bar / Tap to Expand-Collapse */}
            <TouchableOpacity
              style={styles.sheetHandleBar}
              onPress={() => setIsSheetExpanded(!isSheetExpanded)}
              activeOpacity={0.8}
            >
              <View style={styles.sheetHandlePill} />
              <View style={styles.sheetHeaderToggleRow}>
                <Text style={styles.sheetHeaderToggleText}>
                  {isSheetExpanded
                    ? 'Slide down to collapse'
                    : queueDonors.length > 0
                    ? `${queueDonors.length} Candidate Beacons Available — Slide Up`
                    : 'Pull up for details'}
                </Text>
                {isSheetExpanded ? (
                  <CaretDown size={14} color={theme.colors.text.secondary} weight="bold" />
                ) : (
                  <CaretUp size={14} color={theme.colors.brand.default} weight="bold" />
                )}
              </View>
            </TouchableOpacity>

            {/* Request Summary details header */}
            <View style={styles.detailsHeader}>
              <TouchableOpacity 
                style={styles.detailsGrid}
                onPress={handleFocusRequestLocation}
                activeOpacity={0.7}
              >
                <View style={styles.bloodTypeBadge}>
                  <Text style={styles.bloodTypeBadgeText}>{activeRequest.patient_blood_group}</Text>
                </View>
                <View style={styles.metaTextCol}>
                  <Text style={styles.patientLabel}>Patient: {activeRequest.patient_name}</Text>
                  <Text style={styles.hospitalLabel} numberOfLines={1}>
                    {activeRequest.location_address}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.headerRightGroup}>
                <View style={styles.unitsPill}>
                  <Clock size={14} color={theme.colors.text.secondary} />
                  <Text style={styles.unitsText}>
                    {activeRequest.units_needed} {activeRequest.units_needed === 1 ? 'Bag' : 'Bags'}
                  </Text>
                </View>

                <AnimatedPressable 
                  style={styles.requestLocationHeaderBtn} 
                  onPress={handleFocusRequestLocation}
                  activeScale={0.92}
                >
                  <Target size={14} color={theme.colors.brand.default} weight="bold" />
                  <Text style={styles.requestLocationHeaderBtnText}>Location</Text>
                </AnimatedPressable>
              </View>
            </View>

            {/* Sliding scroll list of nearby invitation queues */}
            <Animated.View style={{ flex: 1, opacity: sheetAnim }}>
              <ScrollView 
                style={styles.queueScroll} 
                contentContainerStyle={styles.queueScrollContainer}
                showsVerticalScrollIndicator={false}
              >
              {matchedDonor && (
                <View style={styles.matchedBannerContainer}>
                  <View style={styles.matchedBannerIconWrapper}>
                    <CheckCircle size={22} color={theme.colors.status.active} weight="fill" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchedBannerTitle}>Match Confirmed & En-Route</Text>
                    <Text style={styles.matchedBannerSubtitle}>
                      {matchedDonor.profiles?.full_name} has accepted and is navigating to {activeRequest.location_address}.
                    </Text>
                    <AnimatedPressable 
                      style={[styles.bannerCompleteBtn, { backgroundColor: theme.colors.status.active }]}
                      onPress={handleCompleteRequest}
                      activeScale={0.96}
                    >
                      <CheckCircle size={15} color="#FFF" weight="fill" />
                      <Text style={styles.bannerCompleteBtnText}>MARK AS FULFILLED / COMPLETE</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              )}

              <Text style={styles.queueEyebrow}>MATCHED CANDIDATE BEACONS</Text>

              {queueDonors.length === 0 ? (
                <View style={styles.emptyQueueCard}>
                  <Text style={styles.emptyQueueText}>
                    Searching matching beacons. Dispatching notifications to compatible local donors...
                  </Text>
                  <ActivityIndicator size="small" color={theme.colors.brand.default} style={{ marginTop: 12 }} />
                </View>
              ) : (
                queueDonors.map((donor) => {
                  const donorState = getDonorStateFromQueue(donor);
                  const isPending = donorState === 'PENDING';
                  const isAccepted = donorState === 'ACCEPTED';
                  const isMatched = donorState === 'MATCHED';
                  const hasMatchedDonor = !!matchedDonor;

                  let statusText = 'Invitation Sent';
                  let borderCol = '#D4D0C8'; // Gray
                  let bgCol = theme.colors.bg.surface;
                  
                  if (isAccepted) {
                    if (hasMatchedDonor) {
                      statusText = 'Ready to Help (Standby)';
                      borderCol = '#FF9500'; // Standby Amber
                    } else {
                      statusText = 'Ready to Help';
                      borderCol = theme.colors.brand.default; // Active Red
                    }
                  } else if (isMatched) {
                    statusText = 'En-Route (Confirmed)';
                    borderCol = theme.colors.status.active; // Green
                    bgCol = theme.dark ? 'rgba(31, 153, 82, 0.08)' : '#EFFBF4';
                  }

                  return (
                    !donor || !donor.profiles ? null : (
                    <View
                      key={donor.id}
                      style={[
                        styles.donorItemCard,
                        { borderColor: theme.colors.border.subtle, borderLeftColor: borderCol, backgroundColor: bgCol }
                      ]}
                    >
                      {/* Left Profile details */}
                      <View style={styles.donorMetaRow}>
                        <AvatarImage 
                          uri={donor.profiles?.avatar_url} 
                          size={32} 
                          borderWidth={donor.profiles?.verification_badge ? 1.5 : 0}
                          borderColor={donor.profiles?.verification_badge ? theme.colors.status.active : undefined}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={styles.nameHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={styles.donorName}>{donor.profiles?.full_name || 'Anonymous Donor'}</Text>
                              {donor.profiles?.verification_badge && (
                                <SealCheck size={14} color={theme.colors.status.active} weight="fill" />
                              )}
                            </View>
                            {isMatched ? (
                              <View style={styles.selectedMatchBadge}>
                                <CheckCircle size={12} color="#FFF" weight="fill" />
                                <Text style={styles.selectedMatchBadgeText}>SELECTED</Text>
                              </View>
                            ) : (
                              <Text style={styles.donorBloodGroup}>{donor.profiles?.blood_group || ''}</Text>
                            )}
                          </View>
                          <Text style={[
                            styles.queueStatusLabel, 
                            isAccepted && { color: theme.colors.brand.default },
                            isMatched && { color: theme.colors.status.activeText }
                          ]}>
                            {statusText}
                          </Text>
                        </View>
                      </View>

                      {/* Interactive cards action */}
                      {isAccepted && (
                        <View style={styles.acceptedActionsRow}>
                          <View style={styles.callButtonsGroup}>
                            <TouchableOpacity
                              style={[styles.actionIconBtn, { borderColor: theme.colors.border.default }]}
                              onPress={() => handleCall(donor.profiles?.phone_number || '')}
                            >
                              <Phone size={16} color={theme.colors.text.primary} weight="bold" />
                              <Text style={styles.actionIconBtnText}>Call</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionIconBtn, { borderColor: theme.colors.border.default }]}
                              onPress={() => handleMessage(donor.profiles?.phone_number || '', donor.profiles?.full_name || '')}
                            >
                              <WhatsappLogo size={16} color="#25D366" weight="fill" />
                              <Text style={styles.actionIconBtnText}>WhatsApp</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.confirmSelectBtn,
                              hasMatchedDonor && { backgroundColor: '#FF9500' }
                            ]}
                            onPress={() => handleConfirmDonor(donor)}
                          >
                            <CheckCircle size={14} color="#FFF" weight="fill" />
                            <Text style={styles.confirmSelectText}>
                              {hasMatchedDonor ? 'SWITCH TO THIS DONOR' : 'CONFIRM MATCH'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {isMatched && (
                        <View style={styles.matchedCallActions}>
                          <TouchableOpacity
                            style={[styles.matchedCallBtn, { borderColor: theme.colors.status.active }]}
                            onPress={() => handleCall(donor.profiles?.phone_number || '')}
                          >
                            <Phone size={16} color={theme.colors.status.active} weight="bold" />
                            <Text style={[styles.matchedCallBtnText, { color: theme.colors.status.active }]}>Call Donor</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.matchedCallBtn, { borderColor: theme.colors.status.active }]}
                            onPress={() => handleMessage(donor.profiles?.phone_number || '', donor.profiles?.full_name || '')}
                          >
                            <WhatsappLogo size={16} color="#25D366" weight="fill" />
                            <Text style={[styles.matchedCallBtnText, { color: theme.colors.status.active }]}>WhatsApp</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    )
                  );
                })
              )}
            </ScrollView>

            {/* Footer Control Panel (Cancel Request) */}
            <View style={[styles.panelFooter, { borderTopColor: theme.colors.border.subtle }]}>
              <TouchableOpacity style={styles.cancelRequestLink} onPress={handleCancelRequest} activeOpacity={0.7}>
                <Text style={styles.cancelRequestLinkText}>Cancel Blood Request</Text>
              </TouchableOpacity>
            </View>
            </Animated.View>
          </View>
        )}
      </Animated.View>
      <CustomModal
        visible={modalVisible}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel || (() => setModalVisible(false))}
        type={modalConfig.type || 'info'}
      />
      </SafeAreaView>
    </AnimatedScreenWrapper>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.page,
  },
  screenHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.bg.surface,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  screenTitle: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 22,
    color: theme.colors.text.primary,
  },
  criticalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.status.criticalBg,
  },
  criticalBadgeText: {
    fontFamily: theme.typography.badge.fontFamily,
    fontSize: 10,
    color: theme.colors.status.criticalText,
    letterSpacing: 0.3,
  },
  mapSegment: {
    flex: 1,
    position: 'relative',
    backgroundColor: theme.colors.bg.subtle,
  },
  mapDisabledWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  mapDisabledText: {
    fontFamily: theme.typography.bodySm.fontFamily,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  floatControlStack: {
    position: 'absolute',
    bottom: 315,
    right: 16,
    gap: 10,
    alignItems: 'center',
    zIndex: 90,
  },
  floatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.bg.surface,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  requestLocationFloatBtn: {
    borderColor: theme.colors.brand.default,
    backgroundColor: theme.dark ? '#2E1214' : '#FFF0F0',
  },
  gpsDotContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsDotHalo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  gpsDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  destinationPinWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationPinRipple: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(230, 48, 48, 0.2)',
  },
  destinationPinCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E63030',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  donorPinContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redPinHalo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(230, 60, 78, 0.25)',
  },
  greenPinHalo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(31, 153, 82, 0.18)',
  },
  amberPinHalo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 149, 0, 0.22)',
  },
  donorPinCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  bottomSheetSegment: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: theme.colors.bg.surfaceRaised,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  sheetHandleBar: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
    backgroundColor: theme.colors.bg.surfaceRaised,
  },
  sheetHandlePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border.strong,
    marginBottom: 4,
  },
  sheetHeaderToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  sheetHeaderToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    letterSpacing: 0.3,
  },
  emptyPanelContent: {
    flex: 1,
    padding: 24,
    paddingBottom: 136,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPanelTitle: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 18,
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  emptyPanelDesc: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  requestCtaBtn: {
    width: '100%',
    height: 52,
    backgroundColor: theme.colors.brand.default,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  requestCtaBtnText: {
    fontFamily: theme.typography.bodyLg.fontFamily,
    fontSize: 14,
    color: theme.colors.text.onColor,
    letterSpacing: 0.5,
  },
  permissionWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 18,
    color: theme.colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionDesc: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  permissionBtn: {
    width: '100%',
    height: 50,
    backgroundColor: theme.colors.brand.default,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBtnText: {
    fontFamily: theme.typography.bodyLg.fontFamily,
    fontSize: 14,
    color: theme.colors.text.onColor,
    letterSpacing: 0.5,
  },
  actionLoaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  actionLoaderText: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 12,
  },
  activePanelWrapper: {
    flex: 1,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  detailsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  bloodTypeBadge: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brand.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bloodTypeBadgeText: {
    fontFamily: theme.typography.blood.fontFamily,
    fontSize: 16,
    color: theme.colors.brand.default,
  },
  metaTextCol: {
    flex: 1,
  },
  patientLabel: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  hospitalLabel: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  unitsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg.subtle,
  },
  unitsText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    color: theme.colors.text.secondary,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestLocationHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.brand.subtle,
    borderWidth: 1,
    borderColor: theme.colors.brand.default,
  },
  requestLocationHeaderBtnText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.brand.default,
  },
  queueScroll: {
    flex: 1,
  },
  queueScrollContainer: {
    padding: 16,
    paddingBottom: 150,
  },
  queueEyebrow: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    color: theme.colors.text.secondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyQueueCard: {
    padding: 20,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyQueueText: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  donorItemCard: {
    borderWidth: 1,
    borderLeftWidth: 3.5,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 10,
  },
  donorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  donorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donorName: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  donorBloodGroup: {
    fontFamily: theme.typography.blood.fontFamily,
    fontSize: 13,
    color: theme.colors.brand.default,
  },
  queueStatusLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    color: theme.colors.text.tertiary,
    marginTop: 2,
  },
  acceptedActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderColor: theme.colors.border.subtle,
    paddingTop: 10,
  },
  callButtonsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
  },
  actionIconBtnText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    color: theme.colors.text.primary,
  },
  confirmSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.status.active,
  },
  confirmSelectText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    color: '#FFF',
    fontWeight: '600',
  },
  matchedCallActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderColor: theme.colors.border.subtle,
    paddingTop: 8,
  },
  matchedCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
  },
  matchedCallBtnText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    fontWeight: '500',
  },
  panelFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 88 : 76,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg.surfaceRaised,
  },
  cancelRequestLink: {
    paddingVertical: 4,
  },
  cancelRequestLinkText: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.brand.default,
  },
  topFilterChipContainer: {
    position: 'absolute',
    top: 14,
    left: 16,
    zIndex: 99,
  },
  topFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  topFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchedBannerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.dark ? 'rgba(31, 153, 82, 0.15)' : '#E6F9EE',
    borderWidth: 1,
    borderColor: theme.colors.status.active,
    marginBottom: 16,
  },
  bannerCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    elevation: 1,
  },
  bannerCompleteBtnText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  matchedBannerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.dark ? 'rgba(31, 153, 82, 0.25)' : '#D1F4E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchedBannerTitle: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.status.activeText,
  },
  matchedBannerSubtitle: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 2,
    lineHeight: 15,
  },
  selectedMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.status.active,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  selectedMatchBadgeText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
