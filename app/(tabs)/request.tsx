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
} from 'react-native';
import CustomModal from '../../components/CustomModal';
import AvatarImage from '../../components/AvatarImage';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import Mapbox from '@rnmapbox/maps';
import { parsePostGISPoint } from '../../utils/geo';
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
} from 'phosphor-react-native';
import { useTheme } from '../../theme';
import CustomLoader from '../../components/CustomLoader';
import { useMapStatus } from '../../hooks/useMapStatus';
import AnimatedScreenWrapper from '../../components/AnimatedScreenWrapper';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '');

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
      let location = await Location.getLastKnownPositionAsync({});
      if (!location) {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }
      if (location) {
        setCurrentUserCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (err) {
      console.warn('GPS location retrieval error:', err);
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

      setQueueDonors((queueData as any) || []);
    } catch (e: any) {
      console.warn('Error querying queue data:', e.message);
    }
  };

  // 3. Setup Supabase Realtime Channels (Realtime queue updates + Presence live locations)
  useEffect(() => {
    if (!activeRequest) return;

    // A. Listen to Realtime Postgres queue changes
    const queueChannel = supabase
      .channel(`request_queues_realtime:${activeRequest.id}`)
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
    const trackingChannel = supabase.channel(`tracking:${activeRequest.id}`);

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
      queueChannel.unsubscribe();
      trackingChannel.unsubscribe();
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
            const activeCoords = liveLocation || profileLocation;
            if (activeCoords) points.push(activeCoords);
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
    const rawState = Array.isArray(donor.profiles.donor_statuses)
      ? donor.profiles.donor_statuses[0]?.state
      : donor.profiles.donor_statuses?.state;

    if (rawState === 'MATCHED') return 'MATCHED';
    if (donor.status === 'ACCEPTED') return 'ACCEPTED';
    return 'PENDING';
  }

  const styles = getStyles(theme);

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
        <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} backgroundColor={theme.colors.bg.page} />
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

  const requestCoordinates = activeRequest ? parsePostGISPoint(activeRequest.location_coords) : null;
  const matchedDonor = queueDonors.find((d) => getDonorStateFromQueue(d) === 'MATCHED');
  
  // Coordinates mapping for routing dash lines
  let routeCoordinates: [number, number][] | null = null;
  if (requestCoordinates && matchedDonor) {
    const donorLive = liveDonorLocations[matchedDonor.donor_id];
    const donorProfile = parsePostGISPoint(matchedDonor.profiles.location_coords);
    const activeDonor = donorLive || donorProfile;
    if (activeDonor) {
      routeCoordinates = [
        [activeDonor.longitude, activeDonor.latitude],
        [requestCoordinates.longitude, requestCoordinates.latitude],
      ];
    }
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
          <Mapbox.MapView style={StyleSheet.absoluteFill} logoEnabled={false} attributionEnabled={false}>
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
              queueDonors.map((donor) => {
                const donorState = getDonorStateFromQueue(donor);
                const liveLocation = liveDonorLocations[donor.donor_id];
                const profileLocation = parsePostGISPoint(donor.profiles.location_coords);
                const markerCoords = liveLocation || profileLocation;

                if (!markerCoords) return null;

                // Color mappings based on queue status states
                let pinColor = '#8C9099'; // gray pending/inactive
                if (donorState === 'ACCEPTED') pinColor = theme.colors.status.pending; // yellow/amber queue
                if (donorState === 'MATCHED') pinColor = theme.colors.status.active; // green matched en route

                return (
                  <Mapbox.MarkerView
                    key={donor.id}
                    id={`donor-${donor.id}`}
                    coordinate={[markerCoords.longitude, markerCoords.latitude]}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.donorPinContainer}>
                      {donorState === 'ACCEPTED' && <View style={styles.yellowPinHalo} />}
                      {donorState === 'MATCHED' && <View style={styles.greenPinHalo} />}
                      <View style={[styles.donorPinCircle, { backgroundColor: pinColor }]}>
                        {donor.profiles.avatar_url ? (
                          <AvatarImage 
                            uri={donor.profiles.avatar_url} 
                            size={24} 
                            borderWidth={0} 
                          />
                        ) : (
                          <MapPin size={14} color="#FFF" weight="fill" />
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
                <Mapbox.LineLayer
                  id="routeLine"
                  style={{
                    lineColor: theme.colors.status.active,
                    lineWidth: 3,
                    lineDasharray: [3, 3],
                    lineOpacity: 0.8,
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

        {/* Floating center action */}
        <TouchableOpacity style={styles.floatRecenterBtn} onPress={handleRecenterMap}>
          <NavigationArrow size={20} color={theme.colors.text.primary} weight="fill" />
        </TouchableOpacity>
      </View>

      {/* Bottom sliding info sheet/panel (Bottom 1/3 of screen) */}
      <View style={styles.bottomSheetSegment}>
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
            <TouchableOpacity
              style={styles.requestCtaBtn}
              onPress={() => router.push('/request/create')}
              activeOpacity={0.8}
            >
              <Plus size={18} color={theme.colors.text.onColor} weight="bold" />
              <Text style={styles.requestCtaBtnText}>REQUEST BLOOD</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Active Matching Queue Dashboard
          <View style={styles.activePanelWrapper}>
            {/* Request Summary details header */}
            <View style={styles.detailsHeader}>
              <View style={styles.detailsGrid}>
                <View style={styles.bloodTypeBadge}>
                  <Text style={styles.bloodTypeBadgeText}>{activeRequest.patient_blood_group}</Text>
                </View>
                <View style={styles.metaTextCol}>
                  <Text style={styles.patientLabel}>Patient: {activeRequest.patient_name}</Text>
                  <Text style={styles.hospitalLabel} numberOfLines={1}>
                    {activeRequest.location_address}
                  </Text>
                </View>
              </View>
              <View style={styles.unitsPill}>
                <Clock size={14} color={theme.colors.text.secondary} />
                <Text style={styles.unitsText}>
                  {activeRequest.units_needed} {activeRequest.units_needed === 1 ? 'Bag' : 'Bags'}
                </Text>
              </View>
            </View>

            {/* Sliding scroll list of nearby invitation queues */}
            <ScrollView 
              style={styles.queueScroll} 
              contentContainerStyle={styles.queueScrollContainer}
              showsVerticalScrollIndicator={false}
            >
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

                  let statusText = 'Invitation Sent';
                  let borderCol = '#D4D0C8'; // Gray
                  let bgCol = theme.colors.bg.surface;
                  
                  if (isAccepted) {
                    statusText = 'Ready to Help';
                    borderCol = theme.colors.status.pending; // Amber/Yellow
                  } else if (isMatched) {
                    statusText = 'En-Route (Confirmed)';
                    borderCol = theme.colors.status.active; // Green
                    bgCol = theme.dark ? 'rgba(31, 153, 82, 0.08)' : '#EFFBF4';
                  }

                  return (
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
                          uri={donor.profiles.avatar_url} 
                          size={32} 
                          borderWidth={donor.profiles.verification_badge ? 1.5 : 0}
                          borderColor={donor.profiles.verification_badge ? theme.colors.status.active : undefined}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={styles.nameHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={styles.donorName}>{donor.profiles.full_name}</Text>
                              {donor.profiles.verification_badge && (
                                <SealCheck size={14} color={theme.colors.status.active} weight="fill" />
                              )}
                            </View>
                            <Text style={styles.donorBloodGroup}>{donor.profiles.blood_group}</Text>
                          </View>
                          <Text style={[
                            styles.queueStatusLabel, 
                            isAccepted && { color: theme.colors.status.pendingText },
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
                              onPress={() => handleCall(donor.profiles.phone_number)}
                            >
                              <Phone size={16} color={theme.colors.text.primary} weight="bold" />
                              <Text style={styles.actionIconBtnText}>Call</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionIconBtn, { borderColor: theme.colors.border.default }]}
                              onPress={() => handleMessage(donor.profiles.phone_number, donor.profiles.full_name)}
                            >
                              <WhatsappLogo size={16} color="#25D366" weight="fill" />
                              <Text style={styles.actionIconBtnText}>WhatsApp</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            style={styles.confirmSelectBtn}
                            onPress={() => handleConfirmDonor(donor)}
                          >
                            <CheckCircle size={14} color="#FFF" weight="fill" />
                            <Text style={styles.confirmSelectText}>CONFIRM MATCH</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {isMatched && (
                        <View style={styles.matchedCallActions}>
                          <TouchableOpacity
                            style={[styles.matchedCallBtn, { borderColor: theme.colors.status.active }]}
                            onPress={() => handleCall(donor.profiles.phone_number)}
                          >
                            <Phone size={16} color={theme.colors.status.active} weight="bold" />
                            <Text style={[styles.matchedCallBtnText, { color: theme.colors.status.active }]}>Call Donor</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.matchedCallBtn, { borderColor: theme.colors.status.active }]}
                            onPress={() => handleMessage(donor.profiles.phone_number, donor.profiles.full_name)}
                          >
                            <WhatsappLogo size={16} color="#25D366" weight="fill" />
                            <Text style={[styles.matchedCallBtnText, { color: theme.colors.status.active }]}>WhatsApp</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Footer Control Panel (Complete/Cancel Request) */}
            <View style={[styles.panelFooter, { borderTopColor: theme.colors.border.subtle }]}>
              {matchedDonor ? (
                <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteRequest}>
                  <CheckCircle size={18} color="#FFF" weight="fill" />
                  <Text style={styles.completeBtnText}>MARK AS FULLFILLED / COMPLETE</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.cancelRequestLink} onPress={handleCancelRequest}>
                <Text style={styles.cancelRequestLinkText}>Cancel Blood Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
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
    flex: 2,
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
  floatRecenterBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
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
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
  yellowPinHalo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(230, 155, 16, 0.18)',
  },
  greenPinHalo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(31, 153, 82, 0.18)',
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
    flex: 1.5,
    backgroundColor: theme.colors.bg.surfaceRaised,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyPanelContent: {
    flex: 1,
    padding: 24,
    paddingBottom: 110,
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
  queueScroll: {
    flex: 1,
  },
  queueScrollContainer: {
    padding: 16,
    paddingBottom: 24,
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
    padding: 12,
    paddingBottom: 110,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  completeBtn: {
    width: '100%',
    height: 48,
    backgroundColor: theme.colors.status.active,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeBtnText: {
    fontFamily: theme.typography.bodyLg.fontFamily,
    fontSize: 13,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  cancelRequestLink: {
    paddingVertical: 4,
  },
  cancelRequestLinkText: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.brand.default,
  },
});
