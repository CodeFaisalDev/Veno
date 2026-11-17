import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Linking,
  DeviceEventEmitter,
  TouchableOpacity,
} from 'react-native';
import CustomLoader from '../../components/CustomLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { 
  Drop, 
  Trophy, 
  Calendar, 
  ShieldCheck, 
  Power,
  WarningCircle,
  Heart,
  MapPin,
  NavigationArrow,
  Users,
  Clock,
  Plus,
  Heartbeat,
  ArrowRight,
  SealCheck,
  Bell,
} from 'phosphor-react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useTheme } from '../../theme';
import { getHaversineDistance, parsePostGISPoint } from '../../utils/geo';
import { registerForPushNotificationsAsync } from '../../utils/notifications';
import * as Location from 'expo-location';
import { startLiveTracking } from '../../utils/tracking';
import { cacheUserLocationRegion } from '../../utils/offlineMapManager';
import CustomModal from '../../components/CustomModal';
import AvatarImage from '../../components/AvatarImage';
import AnimatedPressable from '../../components/AnimatedPressable';
import AnimatedScreenWrapper from '../../components/AnimatedScreenWrapper';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

interface UserProfile {
  id: string;
  full_name: string;
  blood_group: string;
  points: number;
  verification_badge: boolean;
  location_coords?: any;
  avatar_url?: string | null;
}

interface DonorStatus {
  state: 'NOT_A_DONOR' | 'ACTIVE' | 'PAUSED' | 'REQUEST_PENDING' | 'IN_QUEUE' | 'MATCHED' | 'COOLDOWN' | 'INELIGIBLE' | 'SUSPENDED';
  donation_cooldown_until: string | null;
  pause_until: string | null;
}

function BeaconPulse() {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(2.2, { duration: 1500 }),
      -1,
      false
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 1500 }),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.colors.status.active,
        },
        pulseStyle,
      ]}
    />
  );
}

export default function DashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [donorStatus, setDonorStatus] = useState<DonorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Stats Metrics
  const [totalDonations, setTotalDonations] = useState<number>(0);
  const [activeUserRequest, setActiveUserRequest] = useState<any>(null);

  // Phase 6 Matching & Invitation States
  const [invitations, setInvitations] = useState<any[]>([]);
  const [activeAccepted, setActiveAccepted] = useState<any>(null);
  const [currentUserCoords, setCurrentUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

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

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch Donor Status
      const { data: statusData, error: statusError } = await supabase
        .from('donor_statuses')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (statusError) throw statusError;
      setDonorStatus(statusData);

      // Fetch user's donations history count
      const { count: countDonations } = await supabase
        .from('donations_history')
        .select('*', { count: 'exact', head: true })
        .eq('donor_id', user.id);
      setTotalDonations(countDonations || 0);

      // Fetch user's active requests created by them
      const { data: requestData } = await supabase
        .from('blood_requests')
        .select('*')
        .eq('requester_id', user.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (requestData) {
        const { count: queueCount } = await supabase
          .from('request_queues')
          .select('*', { count: 'exact', head: true })
          .eq('request_id', requestData.id)
          .neq('status', 'DECLINED');
        setActiveUserRequest({ ...requestData, queueCount: queueCount || 0 });
      } else {
        setActiveUserRequest(null);
      }

      // Fetch Pending Invitations for this donor
      const { data: invData } = await supabase
        .from('request_queues')
        .select(`
          id,
          status,
          request_id,
          blood_requests:request_id (
            id,
            patient_name,
            patient_blood_group,
            location_address,
            location_coords,
            urgency,
            notes,
            status,
            profiles:requester_id (
              avatar_url,
              verification_badge
            )
          )
        `)
        .eq('donor_id', user.id)
        .eq('status', 'PENDING');

      const filteredInv = (invData || []).filter(
        (inv: any) => inv.blood_requests && inv.blood_requests.status === 'ACTIVE'
      );
      setInvitations(filteredInv);

      // Fetch Active Accepted Request
      const { data: acceptedData } = await supabase
        .from('request_queues')
        .select(`
          id,
          status,
          request_id,
          blood_requests:request_id (
            id,
            patient_name,
            patient_blood_group,
            location_address,
            location_coords,
            urgency,
            notes,
            status,
            profiles:requester_id (
              avatar_url,
              verification_badge
            )
          )
        `)
        .eq('donor_id', user.id)
        .eq('status', 'ACCEPTED');

      const activeAcceptedItem = (acceptedData || []).find(
        (item: any) => item.blood_requests && item.blood_requests.status === 'ACTIVE'
      );
      if (activeAcceptedItem) {
        setActiveAccepted(activeAcceptedItem.blood_requests);
      } else {
        setActiveAccepted(null);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Fetch GPS Coords
    const getGPS = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          let location: Location.LocationObject | null = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!location) {
            location = await Location.getLastKnownPositionAsync({});
          }
          if (location) {
            const { latitude, longitude } = location.coords;
            setCurrentUserCoords({
              latitude,
              longitude,
            });
            // Trigger dynamic 20km offline tile caching in background
            cacheUserLocationRegion(latitude, longitude);
          }
        }
      } catch (e) {
        console.warn('GPS fetch failed in dashboard index:', e);
      }
    };
    getGPS();

    // Dynamically register push notifications on mount to ensure permissions are up to date
    const registerPush = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from('profiles')
              .update({ push_token: token })
              .eq('id', user.id);
          }
        }
      } catch (err) {
        console.warn('Error during dashboard push notifications registration:', err);
      }
    };

    registerPush();

    // Listen for manual updates
    const profileSub = DeviceEventEmitter.addListener('profileUpdated', () => {
      fetchData();
    });

    // Refresh on tab focus
    const unsubscribeFocus = navigation.addListener('focus', () => {
      fetchData();
    });

    return () => {
      profileSub.remove();
      unsubscribeFocus();
    };
  }, [navigation]);

  const getDistanceText = (reqCoords: any) => {
    const parsedReq = parsePostGISPoint(reqCoords);
    const parsedDonor = currentUserCoords || parsePostGISPoint(profile?.location_coords);

    if (parsedReq && parsedDonor) {
      const km = getHaversineDistance(
        parsedDonor.latitude,
        parsedDonor.longitude,
        parsedReq.latitude,
        parsedReq.longitude
      );
      return `${km.toFixed(1)} km away`;
    }
    return '';
  };

  const handleAcceptInvite = async (invitationId: string, requestId: string) => {
    setIsUpdating(true);
    try {
      // 1. Request foreground/background permissions
      const { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
      if (foreStatus !== 'granted') {
        showCustomAlert({
          title: 'Permission Denied',
          description: 'Foreground location permission is required to accept.',
          type: 'danger',
          onConfirm: () => setModalVisible(false),
        });
        setIsUpdating(false);
        return;
      }

      // Check background permission
      const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backStatus !== 'granted') {
        showCustomAlert({
          title: 'Background Location Required',
          description: 'Veno requires background location permissions to stream en-route updates to the patient. Please grant background location in device settings.',
          confirmText: 'Open Settings',
          cancelText: 'Cancel',
          type: 'warning',
          onConfirm: () => {
            setModalVisible(false);
            Linking.openSettings();
          },
          onCancel: () => setModalVisible(false),
        });
        setIsUpdating(false);
        return;
      }

      // Get current location coords
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;

      // 2. Update request queue status to ACCEPTED and store starting coordinates
      const { error: queueErr } = await supabase
        .from('request_queues')
        .update({
          status: 'ACCEPTED',
          location_coords: (lng !== null && lat !== null && !isNaN(lng) && !isNaN(lat)) 
            ? `POINT(${lng} ${lat})` 
            : null
        })
        .eq('id', invitationId);

      if (queueErr) throw queueErr;

      // 3. Transition donor state to IN_QUEUE
      const { error: stateErr } = await supabase
        .from('donor_statuses')
        .update({
          state: 'IN_QUEUE',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', profile?.id);

      if (stateErr) throw stateErr;

      // 4. Start background tracking service
      const invite = invitations.find(i => i.id === invitationId);
      const reqCoords = invite?.blood_requests?.location_coords;
      const parsedDest = parsePostGISPoint(reqCoords);
      await startLiveTracking(requestId, parsedDest?.latitude, parsedDest?.longitude);

      showCustomAlert({
        title: 'Match Accepted',
        description: 'You have successfully joined the donation queue. Live location sharing is active.',
        confirmText: 'Launch Tracker',
        type: 'success',
        onConfirm: () => {
          setModalVisible(false);
          router.push(`/tracking/${requestId}`);
        }
      });
    } catch (e: any) {
      showCustomAlert({
        title: 'Accept Match Failed',
        description: e.message || 'An unexpected error occurred.',
        type: 'danger',
        onConfirm: () => setModalVisible(false),
      });
    } finally {
      setIsUpdating(false);
      fetchData();
    }
  };

  const handleDeclineInvite = async (invitationId: string) => {
    showCustomAlert({
      title: 'Decline Invitation',
      description: 'Are you sure you want to decline this matching request invitation?',
      confirmText: 'Yes, Decline',
      cancelText: 'No',
      type: 'question',
      onConfirm: async () => {
        setModalVisible(false);
        setIsUpdating(true);
        try {
          const { error } = await supabase
            .from('request_queues')
            .update({ status: 'DECLINED' })
            .eq('id', invitationId);

          if (error) throw error;
          
          showCustomAlert({
            title: 'Declined',
            description: 'Matching invitation declined.',
            type: 'success',
            onConfirm: () => {
              setModalVisible(false);
              fetchData();
            }
          });
        } catch (err: any) {
          showCustomAlert({
            title: 'Error',
            description: err.message || 'Failed to decline request.',
            type: 'danger',
            onConfirm: () => setModalVisible(false),
          });
        } finally {
          setIsUpdating(false);
        }
      },
      onCancel: () => setModalVisible(false)
    });
  };

  const handleCancelActiveRequest = async (requestId: string) => {
    showCustomAlert({
      title: 'Cancel Blood Request',
      description: 'Are you sure you want to cancel this request? Any queued active matching donors will be released.',
      confirmText: 'Yes, Cancel',
      cancelText: 'No',
      type: 'danger',
      onConfirm: async () => {
        setModalVisible(false);
        setIsUpdating(true);
        try {
          // 1. Release matched donor if any back to ACTIVE availability
          const { data: queueData } = await supabase
            .from('request_queues')
            .select('donor_id, status')
            .eq('request_id', requestId);

          const matchedItem = (queueData || []).find((d: any) => d.status === 'ACCEPTED');
          if (matchedItem) {
            await supabase
              .from('donor_statuses')
              .update({ state: 'ACTIVE', updated_at: new Date().toISOString() })
              .eq('user_id', matchedItem.donor_id);
          }

          // 2. Set request status to CANCELLED
          const { error: cancelErr } = await supabase
            .from('blood_requests')
            .update({ status: 'CANCELLED' })
            .eq('id', requestId);

          if (cancelErr) throw cancelErr;

          // 3. Clear queues
          await supabase
            .from('request_queues')
            .update({ status: 'DECLINED' })
            .eq('request_id', requestId);

          showCustomAlert({
            title: 'Cancelled',
            description: 'Blood request cancelled successfully.',
            type: 'success',
            onConfirm: () => {
              setModalVisible(false);
              fetchData();
            }
          });
        } catch (e: any) {
          showCustomAlert({
            title: 'Error',
            description: e.message || 'Failed to cancel blood request.',
            type: 'danger',
            onConfirm: () => setModalVisible(false)
          });
        } finally {
          setIsUpdating(false);
        }
      },
      onCancel: () => setModalVisible(false)
    });
  };

  const handleToggleDonorStatus = async () => {
    if (!profile || !donorStatus || isUpdating) return;

    const currentState = donorStatus.state;
    let nextState: 'ACTIVE' | 'PAUSED' | 'NOT_A_DONOR' = 'ACTIVE';

    if (currentState === 'ACTIVE') {
      nextState = 'PAUSED';
    } else if (currentState === 'PAUSED' || currentState === 'NOT_A_DONOR') {
      nextState = 'ACTIVE';
    } else {
      showCustomAlert({
        title: 'Action Restricted',
        description: `Your account status is currently "${currentState}". You cannot toggle your donor availability until the cooldown/restriction is lifted.`,
        type: 'warning',
        onConfirm: () => setModalVisible(false),
      });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('donor_statuses')
        .update({
          state: nextState,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', profile.id);

      if (error) throw error;
      
      setDonorStatus(prev => prev ? { ...prev, state: nextState } : null);
      
      showCustomAlert({
        title: 'Status Updated',
        description: `Your donor status is now: ${nextState === 'ACTIVE' ? 'ACTIVE (Visible to matching requests)' : 'PAUSED (Invisible to requests)'}`,
        type: 'success',
        onConfirm: () => setModalVisible(false),
      });
    } catch (err) {
      showCustomAlert({
        title: 'Error',
        description: 'Failed to update donor status. Please check your network.',
        type: 'danger',
        onConfirm: () => setModalVisible(false),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.bg.page }]}>
        <CustomLoader message="Loading Veno Dashboard..." />
      </View>
    );
  }

  const isDonorActive = donorStatus?.state === 'ACTIVE';
  const displayStatus = donorStatus?.state || 'NOT_A_DONOR';

  const formatDonorState = (state: string) => {
    switch (state) {
      case 'ACTIVE': return 'BEACON ACTIVE';
      case 'PAUSED': return 'PAUSED';
      case 'COOLDOWN': return 'IN COOLDOWN';
      case 'INELIGIBLE': return 'INELIGIBLE';
      case 'SUSPENDED': return 'SUSPENDED';
      case 'NOT_A_DONOR': return 'STANDBY';
      default: return state;
    }
  };

  // Get semantic badge colors matching VENO_DESIGN.md section 6.4
  const getBadgeStyle = () => {
    switch (displayStatus) {
      case 'ACTIVE':
        return { bg: theme.colors.status.activeBg, text: theme.colors.status.activeText };
      case 'PAUSED':
      case 'COOLDOWN':
        return { bg: theme.colors.status.cooldownBg, text: theme.colors.status.cooldownText };
      case 'INELIGIBLE':
      case 'SUSPENDED':
        return { bg: theme.colors.status.criticalBg, text: theme.colors.status.criticalText };
      default:
        return { bg: theme.colors.bg.subtle, text: theme.colors.text.secondary };
    }
  };

  const badgeColors = getBadgeStyle();
  const livesSaved = totalDonations * 3;

  return (
    <AnimatedScreenWrapper style={{ backgroundColor: theme.colors.bg.page }} screenIndex={0}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.page }]} edges={['top']}>
        <StatusBar 
          barStyle={theme.dark ? "light-content" : "dark-content"} 
          backgroundColor={theme.colors.bg.page} 
          translucent={false}
        />
        
        {/* Header (Airbnb style: clean spacing, typography hierarchy, border-subtle) */}
        <View style={[styles.header, { 
          backgroundColor: theme.colors.bg.surface,
          borderBottomColor: theme.colors.border.subtle,
        }]}>
          <View style={styles.headerProfileRow}>
            <AvatarImage 
              uri={profile?.avatar_url} 
              size={46} 
              borderWidth={1.5}
              borderColor={theme.colors.border.default}
            />
            <View style={styles.headerTextContainer}>
              <Text style={[styles.brandLogo, { 
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.brand.default,
              }]}>VENO</Text>
              <View style={styles.nameBadgeRow}>
                <Text style={[styles.greetingText, { 
                  fontFamily: theme.typography.h2.fontFamily,
                  color: theme.colors.text.primary,
                }]}>Hello, {profile?.full_name || 'User'}</Text>
                
                {/* Verified / Not Verified badge */}
                {profile?.verification_badge ? (
                  <View style={[styles.verifiedHeaderBadge, { backgroundColor: theme.colors.status.activeBg }]}>
                    <SealCheck size={12} color={theme.colors.status.activeText} weight="fill" />
                    <Text style={[styles.verifiedHeaderBadgeText, { color: theme.colors.status.activeText, fontFamily: theme.typography.badge.fontFamily }]}>
                      Verified
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                     style={[styles.unverifiedHeaderBadge, { backgroundColor: theme.colors.status.criticalBg }]}
                    onPress={() => router.push('/verify/nid-upload')}
                    activeOpacity={0.7}
                  >
                    <WarningCircle size={12} color={theme.colors.status.criticalText} weight="fill" />
                    <Text style={[styles.unverifiedHeaderBadgeText, { color: theme.colors.status.criticalText, fontFamily: theme.typography.badge.fontFamily }]}>
                      Unverified
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.headerBellBtn, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.subtle }]}
            onPress={() => {
              showCustomAlert({
                title: 'Activity Notifications',
                description: 'All emergency matching dispatch alerts and vital notifications will appear here.',
                confirmText: 'Understood',
                type: 'info',
                onConfirm: () => setModalVisible(false),
              });
            }}
            activeOpacity={0.7}
          >
            <Bell size={20} color={theme.colors.text.primary} weight="regular" />
            <View style={[styles.headerBellDot, { backgroundColor: theme.colors.brand.default }]} />
          </TouchableOpacity>
        </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* ======================================================== */}
        {/* 1. RECIPIENT CONSOLE (Request Side) */}
        {/* ======================================================== */}
        <View style={styles.consoleSection}>
          <View style={styles.consoleSectionHeader}>
            <Heartbeat size={16} color={theme.colors.brand.default} weight="bold" />
            <Text style={[styles.consoleTitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.caption.fontFamily }]}>
              Recipient Console
            </Text>
          </View>

          {activeUserRequest ? (
            /* Active Blood Request Status Card */
            <View style={[styles.recipientActiveCard, {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              borderColor: theme.colors.status.active,
              borderWidth: 1.5,
              borderLeftWidth: 6,
              ...theme.shadows.elevation2,
            }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleCol}>
                  <Text style={[styles.requestLabelText, { color: theme.colors.status.activeText, fontFamily: theme.typography.caption.fontFamily }]}>
                    YOUR ACTIVE REQUEST BROADCAST
                  </Text>
                  <Text style={[styles.patientTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.h2.fontFamily }]}>
                    Patient: {activeUserRequest.patient_name}
                  </Text>
                </View>
                <View style={[styles.bloodTypeBadge, { backgroundColor: theme.colors.brand.subtle }]}>
                  <Text style={[styles.bloodTypeBadgeText, { color: theme.colors.brand.default, fontFamily: theme.typography.blood.fontFamily }]}>
                    {activeUserRequest.patient_blood_group}
                  </Text>
                </View>
              </View>

              <View style={styles.requestMetaRow}>
                <MapPin size={16} color={theme.colors.text.secondary} />
                <Text style={[styles.requestMetaText, { color: theme.colors.text.secondary, fontFamily: theme.typography.bodySm.fontFamily }]} numberOfLines={1}>
                  {activeUserRequest.location_address}
                </Text>
              </View>

              <View style={styles.requestProgressSection}>
                <View style={styles.progressHeaderRow}>
                  <Users size={16} color={theme.colors.status.pendingText} />
                  <Text style={[styles.progressHeaderText, { color: theme.colors.text.primary, fontFamily: theme.typography.body.fontFamily }]}>
                    Matching: <Text style={{ fontWeight: '600' }}>{activeUserRequest.queueCount} compatible donor{activeUserRequest.queueCount === 1 ? '' : 's'}</Text> in queue
                  </Text>
                </View>
                <View style={styles.progressBarWrapper}>
                  <View style={[styles.progressBarBg, { backgroundColor: theme.colors.bg.subtle }]}>
                    <View style={[
                      styles.progressBarFill, 
                      { 
                        backgroundColor: theme.colors.status.active, 
                        width: activeUserRequest.queueCount > 0 ? `${Math.min(100, activeUserRequest.queueCount * 25)}%` : '5%' 
                      }
                    ]} />
                  </View>
                </View>
              </View>

              <View style={styles.activeRequestActions}>
                <AnimatedPressable
                  style={[styles.recipientGoBtn, { backgroundColor: theme.colors.brand.default, borderRadius: theme.radius.md }]}
                  onPress={() => router.push('/request')}
                >
                  <NavigationArrow size={14} color="#FFF" weight="fill" />
                  <Text style={styles.recipientGoBtnText}>Live Matching Queue</Text>
                </AnimatedPressable>

                <AnimatedPressable
                  style={[styles.recipientCancelBtn, { borderColor: theme.colors.border.strong, borderRadius: theme.radius.md }]}
                  onPress={() => handleCancelActiveRequest(activeUserRequest.id)}
                >
                  <Text style={[styles.recipientCancelBtnText, { color: theme.colors.text.primary }]}>Cancel Request</Text>
                </AnimatedPressable>
              </View>
            </View>
          ) : (
            /* Empty State CTA card to Request Blood */
            <AnimatedPressable 
              style={[styles.recipientEmptyCard, {
                backgroundColor: theme.colors.bg.surface,
                borderRadius: theme.radius.lg,
                borderColor: theme.colors.brand.default + '35',
                borderWidth: 1.5,
                ...theme.shadows.elevation2,
              }]}
              onPress={() => router.push('/request/create')}
            >
              <View style={styles.emptyCardContent}>
                <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.brand.subtle }]}>
                  <Plus size={22} color={theme.colors.brand.default} weight="bold" />
                </View>
                <View style={styles.emptyTextCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <Text style={[styles.emptyTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.h3.fontFamily }]}>
                      Request Blood Donation
                    </Text>
                    <View style={{ backgroundColor: theme.colors.brand.subtle, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: theme.colors.brand.default, letterSpacing: 0.5 }}>URGENT</Text>
                    </View>
                  </View>
                  <Text style={[styles.emptyDesc, { color: theme.colors.text.secondary, fontFamily: theme.typography.bodySm.fontFamily }]}>
                    Broadcast immediate emergency notification to matching donors within 5–10km.
                  </Text>
                </View>
                <ArrowRight size={18} color={theme.colors.brand.default} weight="bold" />
              </View>
            </AnimatedPressable>
          )}
        </View>

        {/* ======================================================== */}
        {/* 2. DONOR CONSOLE (Donation Side) */}
        {/* ======================================================== */}
        <View style={styles.consoleSection}>
          <View style={styles.consoleSectionHeader}>
            <Heart size={16} color={theme.colors.brand.default} weight="bold" />
            <Text style={[styles.consoleTitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.caption.fontFamily }]}>
              Donor Console
            </Text>
          </View>

          {/* En-Route Active Match (If en-route to donate) */}
          {activeAccepted && (
            <View style={{ marginBottom: 16 }}>
              <View style={[styles.card, {
                backgroundColor: theme.colors.bg.surface,
                borderRadius: theme.radius.lg,
                borderColor: theme.colors.status.active,
                borderWidth: 1.5,
                borderLeftWidth: 6,
                ...theme.shadows.elevation2,
              }]}>
                <View style={styles.statusHeaderRow}>
                  <Text style={[styles.cardLabel, {
                    fontFamily: theme.typography.caption.fontFamily,
                    color: theme.colors.status.activeText,
                    fontWeight: '600',
                  }]}>MATCH ACTIVE — EN ROUTE</Text>
                  
                  <View style={[styles.statusBadge, {
                    backgroundColor: theme.colors.status.activeBg,
                    borderRadius: theme.radius.sm,
                  }]}>
                    <Text style={[styles.statusBadgeText, {
                      fontFamily: theme.typography.badge.fontFamily,
                      color: theme.colors.status.activeText,
                    }]}>MATCHED</Text>
                  </View>
                </View>

                <View style={styles.matchDetailsCol}>
                  <View style={styles.matchDetailsRow}>
                    <AvatarImage 
                      uri={activeAccepted.profiles?.avatar_url} 
                      size={42} 
                      borderWidth={1}
                      borderColor={theme.colors.border.subtle}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.matchTitle, {
                        fontFamily: theme.typography.h3.fontFamily,
                        color: theme.colors.text.primary,
                        fontSize: 15,
                      }]}>
                        Patient: {activeAccepted.patient_name} ({activeAccepted.patient_blood_group})
                      </Text>
                      <Text style={[styles.matchDesc, {
                        fontFamily: theme.typography.bodySm.fontFamily,
                        color: theme.colors.text.secondary,
                        marginTop: 2,
                      }]}>
                        Hospital: {activeAccepted.location_address}
                      </Text>
                    </View>
                  </View>
                  {getDistanceText(activeAccepted.location_coords) ? (
                    <Text style={[styles.matchDistance, {
                      fontFamily: theme.typography.caption.fontFamily,
                      color: theme.colors.brand.text,
                      marginTop: 4,
                    }]}>
                      {getDistanceText(activeAccepted.location_coords)}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[styles.resumeTrackBtn, {
                    backgroundColor: theme.colors.status.active,
                    borderRadius: theme.radius.md,
                    marginTop: 16,
                  }]}
                  onPress={() => router.push(`/tracking/${activeAccepted.id}`)}
                  activeOpacity={0.8}
                >
                  <NavigationArrow size={16} color="#FFF" weight="fill" />
                  <Text style={styles.resumeTrackBtnText}>RESUME NAVIGATION CONSOLE</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Pending Match Invitations List */}
          {invitations.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.sectionTitle, {
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.text.secondary,
              }]}>Match invitations ({invitations.length})</Text>

              {invitations.map((inv) => {
                const req = inv.blood_requests;
                const isCritical = req.urgency === 'CRITICAL';
                const cardBorderColor = isCritical ? theme.colors.status.critical : theme.colors.status.pending;
                const titleColor = isCritical ? theme.colors.status.criticalText : theme.colors.status.pendingText;
                
                return (
                  <View 
                    key={inv.id}
                    style={[styles.card, {
                      backgroundColor: theme.colors.bg.surface,
                      borderRadius: theme.radius.lg,
                      borderColor: cardBorderColor,
                      borderWidth: 1.5,
                      borderLeftWidth: 6,
                      marginBottom: 12,
                      ...theme.shadows.elevation2,
                    }]}
                  >
                    <View style={styles.statusHeaderRow}>
                      <Text style={[styles.cardLabel, {
                        fontFamily: theme.typography.caption.fontFamily,
                        color: titleColor,
                        fontWeight: '600',
                      }]}>
                        {isCritical ? 'URGENT CRITICAL REQUEST' : 'MATCHING REQUEST'}
                      </Text>
                      
                      <View style={[styles.statusBadge, {
                        backgroundColor: isCritical ? theme.colors.status.criticalBg : theme.colors.status.pendingBg,
                        borderRadius: theme.radius.sm,
                      }]}>
                        <Text style={[styles.statusBadgeText, {
                          fontFamily: theme.typography.badge.fontFamily,
                          color: isCritical ? theme.colors.status.criticalText : theme.colors.status.pendingText,
                        }]}>
                          {req.urgency}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.matchDetailsCol}>
                      <View style={styles.invitationHeaderRow}>
                        <AvatarImage 
                          uri={req.profiles?.avatar_url} 
                          size={40} 
                          borderWidth={1}
                          borderColor={theme.colors.border.subtle}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.matchTitle, {
                            fontFamily: theme.typography.h3.fontFamily,
                            color: theme.colors.text.primary,
                          }]}>
                            Patient: {req.patient_name} ({req.patient_blood_group})
                          </Text>
                          <Text style={[styles.matchDesc, {
                            fontFamily: theme.typography.bodySm.fontFamily,
                            color: theme.colors.text.secondary,
                            marginTop: 2,
                          }]}>
                            Hospital: {req.location_address}
                          </Text>
                        </View>
                      </View>

                      {getDistanceText(req.location_coords) ? (
                        <Text style={[styles.matchDistance, {
                          fontFamily: theme.typography.caption.fontFamily,
                          color: theme.colors.brand.text,
                          marginTop: 8,
                        }]}>
                          Estimated: {getDistanceText(req.location_coords)}
                        </Text>
                      ) : null}

                      {req.notes ? (
                        <Text style={[styles.invitationNotes, {
                          fontFamily: theme.typography.bodySm.fontFamily,
                          color: theme.colors.text.secondary,
                          backgroundColor: theme.colors.bg.subtle,
                          borderRadius: theme.radius.sm,
                          padding: 10,
                          marginTop: 10,
                        }]}>
                          Notes: "{req.notes}"
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.invitationActionsRow}>
                      <TouchableOpacity
                        style={[styles.declineBtn, { borderColor: theme.colors.border.strong }]}
                        onPress={() => handleDeclineInvite(inv.id)}
                        disabled={isUpdating}
                      >
                        <Text style={[styles.declineBtnText, { color: theme.colors.text.primary }]}>Decline</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.acceptBtn, { backgroundColor: theme.colors.brand.default }]}
                        onPress={() => handleAcceptInvite(inv.id, req.id)}
                        disabled={isUpdating}
                      >
                        <Heart size={14} color="#FFF" weight="fill" />
                        <Text style={styles.acceptBtnText}>Accept & Help</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Availability Card status */}
          <View style={{ marginBottom: 16 }}>
            <View style={[styles.card, { 
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              borderColor: theme.colors.border.subtle,
              borderWidth: theme.dark ? 0 : 1,
              ...theme.shadows.elevation1,
            }]}>
              <View style={styles.statusHeaderRow}>
                <Text style={[styles.cardLabel, { 
                  fontFamily: theme.typography.caption.fontFamily,
                  color: theme.colors.text.secondary,
                }]}>AVAILABILITY BEACON STATUS</Text>
                
                <View style={[styles.statusBadge, { 
                  backgroundColor: badgeColors.bg,
                  borderRadius: theme.radius.sm,
                }]}>
                  {/* Glowing beacon circle */}
                  <View style={{ position: 'relative', width: 8, height: 8, marginRight: 6, justifyContent: 'center', alignItems: 'center' }}>
                    {displayStatus === 'ACTIVE' && <BeaconPulse />}
                    <View style={[styles.beaconDot, { backgroundColor: displayStatus === 'ACTIVE' ? theme.colors.status.active : theme.colors.text.tertiary, marginRight: 0 }]} />
                  </View>
                  <Text style={[styles.statusBadgeText, { 
                    fontFamily: theme.typography.badge.fontFamily,
                    color: badgeColors.text,
                  }]}>
                    {formatDonorState(displayStatus)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.statusExplanation, { 
                fontFamily: theme.typography.body.fontFamily,
                color: theme.colors.text.secondary,
              }]}>
                {isDonorActive 
                  ? "Your donor beacon is active. Nearby patients and hospitals matching your blood group can discover you in real-time."
                  : donorStatus?.state === 'COOLDOWN'
                  ? "You are currently in recovery cooldown following a successful donation. Thank you for your service!"
                  : donorStatus?.state === 'INELIGIBLE'
                  ? "Your account is flagged ineligible due to medical/health rules. Please update your profile."
                  : "Your beacon is on standby. Switch to Active to receive urgent donation alerts from nearby patients."
                }
              </Text>

              {(displayStatus === 'ACTIVE' || displayStatus === 'PAUSED' || displayStatus === 'NOT_A_DONOR') && (
                <AnimatedPressable 
                  style={[
                    styles.toggleButton,
                    isDonorActive ? styles.toggleButtonActive : styles.toggleButtonPaused,
                    { 
                      borderRadius: theme.radius.md,
                      borderColor: isDonorActive ? theme.colors.border.default : theme.colors.brand.default,
                      backgroundColor: isDonorActive ? 'transparent' : theme.colors.brand.default,
                    }
                  ]} 
                  onPress={handleToggleDonorStatus}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <CustomLoader size="small" color={isDonorActive ? theme.colors.text.primary : theme.colors.text.onColor} />
                  ) : (
                    <Text style={[
                      styles.toggleButtonText,
                      { 
                        fontFamily: theme.typography.bodyLg.fontFamily,
                        color: isDonorActive ? theme.colors.text.primary : theme.colors.text.onColor 
                      }
                    ]}>
                      {isDonorActive ? 'Pause Availability' : 'Go Active / Receive Requests'}
                    </Text>
                  )}
                </AnimatedPressable>
              )}
            </View>
          </View>

          {/* Premium Bento Grid Metrics Section */}
          <Text style={[styles.sectionTitle, { 
            fontFamily: theme.typography.caption.fontFamily,
            color: theme.colors.text.secondary,
            marginTop: 8,
          }]}>Donor Metrics</Text>
          
          <View style={styles.gridRow}>
            {/* Blood Type Card */}
            <AnimatedPressable 
              style={[styles.gridCard, { 
                backgroundColor: theme.colors.bg.surface,
                borderRadius: theme.radius.lg,
                borderColor: theme.colors.border.subtle,
                borderWidth: 1,
                ...theme.shadows.elevation1,
              }]}
              onPress={() => {
                showCustomAlert({
                  title: `Blood Type: ${profile?.blood_group || 'O+'}`,
                  description: `As an ${profile?.blood_group || 'O+'} donor, your red blood cells can provide life-saving support to compatible local emergency recipients.`,
                  confirmText: 'Understood',
                  type: 'info',
                  onConfirm: () => setModalVisible(false),
                });
              }}
            >
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.brand.subtle }]}>
                <Drop size={18} color={theme.colors.brand.default} weight="fill" />
              </View>
              <Text style={[styles.cardBloodValue, { 
                fontFamily: theme.typography.blood.fontFamily,
                color: theme.colors.brand.default,
              }]}>
                {profile?.blood_group || '—'}
              </Text>
              <Text style={[styles.cardSubLabel, { 
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.text.secondary,
              }]}>BLOOD TYPE</Text>
            </AnimatedPressable>

            {/* Score Points Card */}
            <AnimatedPressable 
              style={[styles.gridCard, { 
                backgroundColor: theme.colors.bg.surface,
                borderRadius: theme.radius.lg,
                borderColor: theme.colors.border.subtle,
                borderWidth: 1,
                ...theme.shadows.elevation1,
              }]}
              onPress={() => {
                showCustomAlert({
                  title: 'Reputation Honor Points',
                  description: `You have ${profile?.points || 0} points. Verified donors earn +100 points for each fulfilled donation request.`,
                  confirmText: 'View Badges',
                  type: 'info',
                  onConfirm: () => setModalVisible(false),
                });
              }}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#FFFBEB' }]}>
                <Trophy size={18} color="#D4A017" weight="regular" />
              </View>
              <Text style={[styles.cardValue, { 
                fontFamily: theme.typography.display.fontFamily,
                color: theme.colors.text.primary,
              }]}>
                {profile?.points || 0}
              </Text>
              <Text style={[styles.cardSubLabel, { 
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.text.secondary,
              }]}>SCORE POINTS</Text>
            </AnimatedPressable>
          </View>

          <View style={styles.gridRow}>
            {/* Donations Card */}
            <AnimatedPressable 
              style={[styles.gridCard, { 
                backgroundColor: theme.colors.bg.surface,
                borderRadius: theme.radius.lg,
                borderColor: theme.colors.border.subtle,
                borderWidth: 1,
                ...theme.shadows.elevation1,
              }]}
              onPress={() => {
                showCustomAlert({
                  title: 'Donation History',
                  description: `You have completed ${totalDonations} verified blood donation${totalDonations === 1 ? '' : 's'} on the Veno network. Thank you for your service!`,
                  confirmText: 'Close',
                  type: 'success',
                  onConfirm: () => setModalVisible(false),
                });
              }}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#EFFBF4' }]}>
                <Heart size={18} color="#1F9952" weight="fill" />
              </View>
              <Text style={[styles.cardValue, { 
                fontFamily: theme.typography.display.fontFamily,
                color: theme.colors.text.primary,
              }]}>
                {totalDonations}
              </Text>
              <Text style={[styles.cardSubLabel, { 
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.text.secondary,
              }]}>DONATIONS</Text>
            </AnimatedPressable>

            {/* Lives Saved Card */}
            <AnimatedPressable 
              style={[styles.gridCard, { 
                backgroundColor: theme.colors.bg.surface,
                borderRadius: theme.radius.lg,
                borderColor: theme.colors.border.subtle,
                borderWidth: 1,
                ...theme.shadows.elevation1,
              }]}
              onPress={() => {
                showCustomAlert({
                  title: 'Lives Saved Impact',
                  description: `Every whole blood donation can help separate platelets, plasma, and red cells to save up to 3 individual lives.`,
                  confirmText: 'Inspiring!',
                  type: 'success',
                  onConfirm: () => setModalVisible(false),
                });
              }}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
                <Users size={18} color="#0284C7" weight="bold" />
              </View>
              <Text style={[styles.cardValue, { 
                fontFamily: theme.typography.display.fontFamily,
                color: theme.colors.text.primary,
              }]}>
                {livesSaved}
              </Text>
              <Text style={[styles.cardSubLabel, { 
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.text.secondary,
              }]}>LIVES SAVED</Text>
            </AnimatedPressable>
          </View>

          <View style={styles.gridRow}>
            {/* Next Eligibility Card */}
            <AnimatedPressable 
              style={[styles.gridCard, { 
                backgroundColor: theme.colors.bg.surface,
                borderRadius: theme.radius.lg,
                borderColor: theme.colors.border.subtle,
                borderWidth: 1,
                ...theme.shadows.elevation1,
              }]}
              onPress={() => router.push('/profile/medical')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#F0FDF4' }]}>
                <Calendar size={18} color="#157A40" weight="regular" />
              </View>
              <Text style={[styles.cardValue, { 
                fontFamily: theme.typography.h2.fontFamily,
                color: theme.colors.text.primary,
                fontSize: 20,
              }]}>
                {donorStatus?.donation_cooldown_until 
                  ? new Date(donorStatus.donation_cooldown_until).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : 'Ready'
                }
              </Text>
              <Text style={[styles.cardSubLabel, { 
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.text.secondary,
              }]}>NEXT ELIGIBILITY</Text>
            </AnimatedPressable>

            {/* Identity Badge Card */}
            <AnimatedPressable 
              style={[styles.gridCard, { 
                backgroundColor: theme.colors.bg.surface,
                borderRadius: theme.radius.lg,
                borderColor: theme.colors.border.subtle,
                borderWidth: 1,
                ...theme.shadows.elevation1,
              }]}
              onPress={() => {
                if (profile?.verification_badge) {
                  showCustomAlert({
                    title: 'Verified Identity',
                    description: 'Your identity has been officially verified. Your profile is active and in high standing.',
                    type: 'success',
                    onConfirm: () => setModalVisible(false),
                  });
                } else {
                  router.push('/verify/nid-upload');
                }
              }}
            >
              <View style={[
                styles.iconContainer, 
                { backgroundColor: profile?.verification_badge ? theme.colors.status.activeBg : theme.colors.brand.subtle }
              ]}>
                <ShieldCheck 
                  size={18} 
                  color={profile?.verification_badge ? theme.colors.status.active : theme.colors.brand.default} 
                  weight="regular"
                />
              </View>
              <Text style={[
                styles.cardValue,
                { 
                  fontFamily: theme.typography.h2.fontFamily,
                  color: profile?.verification_badge ? theme.colors.status.active : theme.colors.brand.default,
                  fontSize: 20,
                }
              ]}>
                {profile?.verification_badge ? 'Verified' : 'Get Verified'}
              </Text>
              <Text style={[styles.cardSubLabel, { 
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.text.secondary,
              }]}>IDENTITY BADGE</Text>
            </AnimatedPressable>
          </View>
        </View>
      </ScrollView>

      {/* Reusable Custom Alert modal overlay */}
      <CustomModal
        visible={modalVisible}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
        type={modalConfig.type}
      />
      </SafeAreaView>
    </AnimatedScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  brandLogo: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  greetingText: {
    fontSize: 20,
    marginTop: 2,
  },
  logoutButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginLeft: 12,
  },
  headerBellDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 150,
  },
  consoleSection: {
    marginBottom: 24,
  },
  consoleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  consoleTitle: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  card: {
    padding: 20,
  },
  cardLabel: {
    fontSize: 12,
    letterSpacing: 1,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  beaconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statusExplanation: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  toggleButton: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  toggleButtonActive: {},
  toggleButtonPaused: {},
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  gridCard: {
    flex: 1,
    padding: 16,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardValue: {
    fontSize: 28,
    marginBottom: 4,
  },
  cardBloodValue: {
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 4,
  },
  cardSubLabel: {
    fontSize: 12,
    letterSpacing: 0.4,
  },
  matchDetailsCol: {
    marginTop: 8,
  },
  matchTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  matchDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  matchDistance: {
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  resumeTrackBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resumeTrackBtnText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  invitationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bloodLabelWrapper: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloodLabelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  invitationNotes: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  invitationActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  declineBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 13,
  },
  acceptBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acceptBtnText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
  },

  // Recipient Console Custom Cards
  recipientActiveCard: {
    padding: 16,
    borderWidth: 1.5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleCol: {
    flex: 1,
    marginRight: 8,
  },
  requestLabelText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  patientTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  bloodTypeBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloodTypeBadgeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  requestMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  requestMetaText: {
    fontSize: 13,
    flex: 1,
  },
  requestProgressSection: {
    marginBottom: 20,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  progressHeaderText: {
    fontSize: 13,
  },
  progressBarWrapper: {
    width: '100%',
  },
  progressBarBg: {
    height: 8,
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  activeRequestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  recipientGoBtn: {
    flex: 1.5,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  recipientGoBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  recipientCancelBtn: {
    flex: 1,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  recipientCancelBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },

  recipientEmptyCard: {
    borderStyle: 'dashed',
  },
  emptyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  emptyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTextCol: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  headerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  verifiedHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  verifiedHeaderBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  unverifiedHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  unverifiedHeaderBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  matchDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
