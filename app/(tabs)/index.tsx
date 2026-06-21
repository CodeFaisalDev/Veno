import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Linking,
} from 'react-native';
import CustomLoader from '../../components/CustomLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { 
  SignOut, 
  Drop, 
  Trophy, 
  Calendar, 
  ShieldCheck, 
  Power,
  WarningCircle,
  ArrowRight,
  Heart,
  MapPin,
  NavigationArrow,
} from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { getHaversineDistance, parsePostGISPoint } from '../../utils/geo';
import { registerForPushNotificationsAsync } from '../../utils/notifications';
import * as Location from 'expo-location';
import { startLiveTracking } from '../../utils/tracking';
import { cacheUserLocationRegion } from '../../utils/offlineMapManager';

interface UserProfile {
  id: string;
  full_name: string;
  blood_group: string;
  points: number;
  verification_badge: boolean;
  location_coords?: any;
}

interface DonorStatus {
  state: 'NOT_A_DONOR' | 'ACTIVE' | 'PAUSED' | 'REQUEST_PENDING' | 'IN_QUEUE' | 'MATCHED' | 'COOLDOWN' | 'INELIGIBLE' | 'SUSPENDED';
  donation_cooldown_until: string | null;
  pause_until: string | null;
}

export default function DashboardScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [donorStatus, setDonorStatus] = useState<DonorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Phase 6 Matching & Invitation States
  const [invitations, setInvitations] = useState<any[]>([]);
  const [activeAccepted, setActiveAccepted] = useState<any>(null);
  const [currentUserCoords, setCurrentUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

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
            status
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
            status
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
          let location = await Location.getLastKnownPositionAsync({});
          if (!location) {
            location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
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
  }, []);



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
        Alert.alert('Permission Denied', 'Foreground location permission is required to accept.');
        setIsUpdating(false);
        return;
      }

      // Check background permission
      const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backStatus !== 'granted') {
        Alert.alert(
          'Background Location Required',
          'Veno requires background location permissions to stream en-route updates to the patient. Please grant background location in device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings();
              }
            }
          ]
        );
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
          location_coords: { type: 'Point', coordinates: [lng, lat] }
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
        .eq('user_id', profile!.id);

      if (stateErr) throw stateErr;

      // 4. Start background tracking service
      const invite = invitations.find(i => i.id === invitationId);
      const reqCoords = invite?.blood_requests?.location_coords;
      const parsedDest = parsePostGISPoint(reqCoords);
      await startLiveTracking(requestId, parsedDest?.latitude, parsedDest?.longitude);

      Alert.alert(
        'Match Accepted',
        'You have successfully joined the donation queue. Live location sharing is active.',
        [
          {
            text: 'Launch Tracker',
            onPress: () => {
              router.push(`/tracking/${requestId}`);
            }
          }
        ]
      );
    } catch (e: any) {
      Alert.alert('Accept Match Failed', e.message || 'An unexpected error occurred.');
    } finally {
      setIsUpdating(false);
      fetchData();
    }
  };

  const handleDeclineInvite = async (invitationId: string) => {
    Alert.alert(
      'Decline Invitation',
      'Are you sure you want to decline this matching request invitation?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Decline',
          style: 'destructive',
          onPress: async () => {
            setIsUpdating(true);
            try {
              const { error } = await supabase
                .from('request_queues')
                .update({ status: 'DECLINED' })
                .eq('id', invitationId);

              if (error) throw error;
              Alert.alert('Declined', 'Matching invitation declined.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to decline request.');
            } finally {
              setIsUpdating(false);
              fetchData();
            }
          }
        }
      ]
    );
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
      Alert.alert(
        'Action Restricted',
        `Your account status is currently "${currentState}". You cannot toggle your donor availability until the cooldown/restriction is lifted.`
      );
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
      Alert.alert('Status Updated', `Your donor status is now: ${nextState === 'ACTIVE' ? 'ACTIVE (Visible to matching requests)' : 'PAUSED (Invisible to requests)'}`);
    } catch (err) {
      Alert.alert('Error', 'Failed to update donor status. Please check your network.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of Veno?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            await supabase.auth.signOut();
          }
        }
      ]
    );
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.page }]} edges={['top']}>
      <StatusBar 
        barStyle={theme.dark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.bg.page} 
      />
      
      {/* Header (Airbnb style: clean spacing, typography hierarchy, border-subtle) */}
      <View style={[styles.header, { 
        backgroundColor: theme.colors.bg.surface,
        borderBottomColor: theme.colors.border.subtle,
      }]}>
        <View>
          <Text style={[styles.brandLogo, { 
            fontFamily: theme.typography.caption.fontFamily,
            color: theme.colors.brand.default,
          }]}>VENO</Text>
          <Text style={[styles.greetingText, { 
            fontFamily: theme.typography.h2.fontFamily,
            color: theme.colors.text.primary,
          }]}>Hello, {profile?.full_name || 'Donor'}</Text>
        </View>
        
        {/* SignOut Button: 44x44px minimum tap target */}
        <TouchableOpacity 
          style={[styles.logoutButton, { 
            backgroundColor: theme.colors.bg.subtle,
            borderRadius: theme.radius.full,
          }]} 
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <SignOut size={20} color={theme.colors.text.primary} weight="regular" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* En-Route Tracking Active Match */}
        {activeAccepted && (
          <View style={[styles.section, { marginBottom: 16 }]}>
            <View style={[styles.card, {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              borderColor: theme.colors.status.active,
              borderWidth: 1.5,
              borderLeftWidth: 5,
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
                <Text style={[styles.matchTitle, {
                  fontFamily: theme.typography.h3.fontFamily,
                  color: theme.colors.text.primary,
                  fontSize: 16,
                }]}>
                  Patient: {activeAccepted.patient_name} ({activeAccepted.patient_blood_group})
                </Text>
                <Text style={[styles.matchDesc, {
                  fontFamily: theme.typography.bodySm.fontFamily,
                  color: theme.colors.text.secondary,
                  marginTop: 4,
                }]}>
                  Hospital: {activeAccepted.location_address}
                </Text>
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
          <View style={styles.section}>
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
                      <View style={[styles.bloodLabelWrapper, { backgroundColor: theme.colors.brand.subtle }]}>
                        <Text style={[styles.bloodLabelText, { color: theme.colors.brand.default }]}>
                          {req.patient_blood_group}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.matchTitle, {
                          fontFamily: theme.typography.h3.fontFamily,
                          color: theme.colors.text.primary,
                        }]}>
                          Patient: {req.patient_name}
                        </Text>
                        <Text style={[styles.matchDesc, {
                          fontFamily: theme.typography.bodySm.fontFamily,
                          color: theme.colors.text.secondary,
                          marginTop: 2,
                        }]}>
                          {req.location_address}
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
                      <Text style={styles.declineBtnText}>Decline</Text>
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

        {/* Availability Section */}
        <View style={styles.section}>
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
              }]}>AVAILABILITY STATUS</Text>
              
              <View style={[styles.statusBadge, { 
                backgroundColor: badgeColors.bg,
                borderRadius: theme.radius.sm,
              }]}>
                <View style={[styles.statusDot, { 
                  backgroundColor: displayStatus === 'ACTIVE' ? theme.colors.status.active : theme.colors.text.tertiary 
                }]} />
                <Text style={[styles.statusBadgeText, { 
                  fontFamily: theme.typography.badge.fontFamily,
                  color: badgeColors.text,
                }]}>
                  {displayStatus}
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
                : "You are paused. You will not receive any blood request notification alerts."
              }
            </Text>

            {(displayStatus === 'ACTIVE' || displayStatus === 'PAUSED' || displayStatus === 'NOT_A_DONOR') && (
              <TouchableOpacity 
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
                activeOpacity={0.8}
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
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Metrics Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { 
            fontFamily: theme.typography.caption.fontFamily,
            color: theme.colors.text.secondary,
          }]}>Donor Metrics</Text>
          
          <View style={styles.gridRow}>
            {/* Blood Type Card */}
            <View style={[styles.gridCard, { 
              backgroundColor: theme.colors.bg.subtle,
              borderRadius: theme.radius.md,
            }]}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.brand.subtle }]}>
                <Drop size={18} color={theme.colors.brand.default} weight="fill" />
              </View>
              <Text style={[styles.cardBloodValue, { 
                fontFamily: theme.typography.blood.fontFamily,
                color: theme.colors.brand.default,
              }]}>
                {profile?.blood_group || 'O+'}
              </Text>
              <Text style={[styles.cardSubLabel, { 
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.text.secondary,
              }]}>MY BLOOD TYPE</Text>
            </View>

            {/* Score Points Card */}
            <View style={[styles.gridCard, { 
              backgroundColor: theme.colors.bg.subtle,
              borderRadius: theme.radius.md,
            }]}>
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
            </View>
          </View>

          <View style={styles.gridRow}>
            {/* Next Eligibility Card */}
            <TouchableOpacity 
              style={[styles.gridCard, { 
                backgroundColor: theme.colors.bg.subtle,
                borderRadius: theme.radius.md,
              }]}
              onPress={() => router.push('/profile/medical')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
                <Calendar size={18} color="#0284C7" weight="regular" />
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
            </TouchableOpacity>

            {/* Identity Badge Card */}
            <TouchableOpacity 
              style={[styles.gridCard, { 
                backgroundColor: theme.colors.bg.subtle,
                borderRadius: theme.radius.md,
              }]}
              onPress={() => {
                if (profile?.verification_badge) {
                  Alert.alert('Verified Identity', 'Your account has been fully verified and is in good standing.');
                } else {
                  router.push('/verify/nid-upload');
                }
              }}
              activeOpacity={0.7}
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
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
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
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
});
