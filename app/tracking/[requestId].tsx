import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  Animated as RNAnimated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { useTheme } from '../../theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Car,
  Clock,
  ShieldWarning,
  NavigationArrow,
  CheckCircle,
  Plus,
} from 'phosphor-react-native';
import Mapbox from '@rnmapbox/maps';
import { getHaversineDistance, parsePostGISPoint, fetchRouteDirections, Coords } from '../../utils/geo';
import { useMapStatus } from '../../hooks/useMapStatus';
import { useLiveTracking } from '../../hooks/useLiveTracking';
import CustomLoader from '../../components/CustomLoader';
import AvatarImage from '../../components/AvatarImage';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

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
  urgency: string;
  status: string;
  requester_id: string;
  avatar_url?: string | null;
}

interface DonorDetails {
  id: string;
  full_name: string;
  phone_number: string;
  avatar_url?: string | null;
}



function PulsingHalo() {
  const theme = useTheme();
  const pulseAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [pulseAnim]);

  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <RNAnimated.View
      style={[
        styles.pulseHalo,
        {
          borderColor: theme.colors.brand.default,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

export default function TrackingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { requestId } = useLocalSearchParams();
  const stringRequestId = Array.isArray(requestId) ? requestId[0] : requestId;

  // DB queries states
  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);
  const [donorDetails, setDonorDetails] = useState<DonorDetails | null>(null);
  const [requesterCoords, setRequesterCoords] = useState<Coords | null>(null);
  const [initialDonorCoords, setInitialDonorCoords] = useState<Coords | null>(null);
  const [isDbLoading, setIsDbLoading] = useState<boolean>(true);

  // Map capping status checks
  const { mapEnabled: remoteMapEnabled, loading: isMapStatusLoading } = useMapStatus(true);
  const [mapEnabled, setMapEnabled] = useState<boolean>(true);

  // Live Location stream hook
  const { donorLocation, interpolatedCoords, isEnRoute } = useLiveTracking(stringRequestId || null);

  const cameraRef = useRef<Mapbox.Camera>(null);

  // Synchronize dynamic capping state
  useEffect(() => {
    setMapEnabled(remoteMapEnabled);
  }, [remoteMapEnabled]);

  // Fetch initial request and accepted donor coordinates
  useEffect(() => {
    if (!stringRequestId) return;

    let active = true;

    async function fetchData() {
      try {
        // 1. Fetch request details with requester profile avatar
        const { data: requestData, error: requestErr } = await supabase
          .from('blood_requests')
          .select(`
            id,
            patient_name,
            patient_blood_group,
            location_address,
            location_coords,
            urgency,
            status,
            requester_id,
            profiles:requester_id (
              avatar_url
            )
          `)
          .eq('id', stringRequestId)
          .single();

        if (requestErr || !requestData) throw requestErr || new Error('Request not found');

        // Parse requester PostGIS point coords
        const reqCoords = parsePostGISPoint(requestData.location_coords);

        if (active) {
          setRequestDetails({
            id: requestData.id,
            patient_name: requestData.patient_name,
            patient_blood_group: requestData.patient_blood_group,
            location_address: requestData.location_address,
            urgency: requestData.urgency,
            status: requestData.status,
            requester_id: requestData.requester_id,
            avatar_url: (requestData.profiles as any)?.avatar_url,
          });
          setRequesterCoords(reqCoords);
        }

        // 2. Fetch accepted donor from queues with donor profile avatar
        const { data: queueData, error: queueErr } = await supabase
          .from('request_queues')
          .select(`
            id,
            status,
            donor_id,
            location_coords,
            profiles:donor_id (
              id,
              full_name,
              phone_number,
              avatar_url
            )
          `)
          .eq('request_id', stringRequestId)
          .eq('status', 'ACCEPTED')
          .limit(1)
          .maybeSingle();

        if (queueData && queueData.profiles) {
          const parsedDonorCoords = parsePostGISPoint(queueData.location_coords);
          const donorProfile = queueData.profiles as any;

          if (active) {
            setDonorDetails({
              id: donorProfile.id,
              full_name: donorProfile.full_name,
              phone_number: donorProfile.phone_number,
              avatar_url: donorProfile.avatar_url,
            });
            setInitialDonorCoords(parsedDonorCoords);
          }
        } else if (active) {
          // Demo fallback for bot testing
          setDonorDetails({
            id: 'd0000000-0000-0000-0000-000000000001',
            full_name: 'Rahim Ahmed (AI Donor)',
            phone_number: '+8801711000001',
            avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
          });
          setInitialDonorCoords({ latitude: 23.7808, longitude: 90.4152 });
        }
      } catch (err) {
        console.error('Error fetching tracking setup data:', err);
      } finally {
        if (active) {
          setIsDbLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      active = false;
    };
  }, [stringRequestId]);



  // Derive coordinates for active rendering
  const activeDonorCoords: Coords | null = interpolatedCoords
    ? { latitude: interpolatedCoords.latitude, longitude: interpolatedCoords.longitude }
    : initialDonorCoords;

  // Road directions polyline state
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | null>(null);

  // Fetch turn-by-turn road route directions from Mapbox
  useEffect(() => {
    if (!requesterCoords || !activeDonorCoords) {
      setRouteCoordinates(null);
      return;
    }

    let active = true;
    const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

    fetchRouteDirections(activeDonorCoords, requesterCoords, mapboxToken).then((coords) => {
      if (active) {
        setRouteCoordinates(coords);
      }
    });

    return () => {
      active = false;
    };
  }, [
    requesterCoords?.latitude,
    requesterCoords?.longitude,
    // Re-fetch directions when donor position shifts (~50 meters)
    Math.round((activeDonorCoords?.latitude || 0) * 2000),
    Math.round((activeDonorCoords?.longitude || 0) * 2000),
  ]);

  // Calculate distance & ETA metrics
  let distanceText = 'Calculating...';
  let etaText = 'Calculating...';
  let distanceKm = 0;

  if (requesterCoords && activeDonorCoords) {
    distanceKm = getHaversineDistance(
      requesterCoords.latitude,
      requesterCoords.longitude,
      activeDonorCoords.latitude,
      activeDonorCoords.longitude
    );

    if (distanceKm < 1) {
      distanceText = `${Math.round(distanceKm * 1000)} m`;
    } else {
      distanceText = `${distanceKm.toFixed(1)} km`;
    }

    const speedMps = donorLocation?.speed || 0;
    const speedKmh = speedMps * 3.6;
    const effectiveSpeed = speedKmh > 5 ? speedKmh : 15; // fallback to 15km/h traffic speed
    const etaMin = Math.max(1, Math.round((distanceKm / effectiveSpeed) * 60));
    etaText = `${etaMin} min${etaMin > 1 ? 's' : ''}`;
  }

  const handleCallDonor = () => {
    if (!donorDetails?.phone_number) {
      Alert.alert('Phone details missing', 'Unable to retrieve donor contact number.');
      return;
    }
    Linking.openURL(`tel:${donorDetails.phone_number}`).catch(() => {
      Alert.alert('Error', 'Unable to place a phone call on this device.');
    });
  };

  const handleRecenter = () => {
    if (cameraRef.current && requesterCoords && activeDonorCoords) {
      const minLng = Math.min(requesterCoords.longitude, activeDonorCoords.longitude);
      const maxLng = Math.max(requesterCoords.longitude, activeDonorCoords.longitude);
      const minLat = Math.min(requesterCoords.latitude, activeDonorCoords.latitude);
      const maxLat = Math.max(requesterCoords.latitude, activeDonorCoords.latitude);

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
    } else if (cameraRef.current && requesterCoords) {
      cameraRef.current.setCamera({
        centerCoordinate: [requesterCoords.longitude, requesterCoords.latitude],
        zoomLevel: 14,
        animationDuration: 1000,
      });
    }
  };

  // Trigger initial recenter once coordinates load
  useEffect(() => {
    if (!isDbLoading && requesterCoords) {
      // Small timeout to allow map layout mounting
      const timer = setTimeout(() => {
        handleRecenter();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isDbLoading, requesterCoords, activeDonorCoords?.latitude]);

  const isLoading = isDbLoading || isMapStatusLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.page }]}>
        <CustomLoader message="Loading tracking console..." />
      </SafeAreaView>
    );
  }

  if (!requestDetails) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.page }]}>
        <View style={styles.errorContainer}>
          <ShieldWarning size={48} color={theme.colors.status.critical} weight="fill" />
          <Text style={[styles.errorTitle, { fontFamily: theme.typography.h2.fontFamily, color: theme.colors.text.primary }]}>
            No Request Found
          </Text>
          <Text style={[styles.errorDesc, { fontFamily: theme.typography.body.fontFamily, color: theme.colors.text.secondary }]}>
            This request could not be found or has already expired.
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.colors.brand.default, borderRadius: theme.radius.md }]}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={[styles.backButtonText, { fontFamily: theme.typography.body.fontFamily, color: theme.colors.text.onColor }]}>
              Return to Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.page }]} edges={['top']}>
      {/* Header Panel */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border.subtle, backgroundColor: theme.colors.bg.surface }]}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <ArrowLeft size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { fontFamily: theme.typography.h3.fontFamily, color: theme.colors.text.primary }]}>
            En-Route Tracking
          </Text>
          <Text style={[styles.headerSubtitle, { fontFamily: theme.typography.caption.fontFamily, color: theme.colors.text.secondary }]}>
            Patient: {requestDetails.patient_name} ({requestDetails.patient_blood_group})
          </Text>
        </View>
        <View style={styles.headerStatusBadge}>
          <View style={[styles.statusDot, { backgroundColor: isEnRoute ? theme.colors.status.active : theme.colors.status.pending }]} />
          <Text style={[styles.statusText, { fontFamily: theme.typography.caption.fontFamily, color: theme.colors.text.secondary }]}>
            {isEnRoute ? 'Live' : 'Waiting'}
          </Text>
        </View>
      </View>

      {/* Main Content Area */}
      {!mapEnabled ? (
        // Text-based Fallback Dashboard when Maps are capped
        <Animated.View entering={FadeIn.duration(400)} style={styles.fallbackScroll}>
          <View style={[styles.warningBanner, { backgroundColor: theme.colors.brand.subtle, borderColor: theme.colors.brand.default + '30' }]}>
            <ShieldWarning size={20} color={theme.colors.brand.default} weight="fill" />
            <View style={styles.warningBannerText}>
              <Text style={[styles.warningBannerTitle, { fontFamily: theme.typography.caption.fontFamily, color: theme.colors.brand.text }]}>
                Resource Safety Active
              </Text>
              <Text style={[styles.warningBannerDesc, { fontFamily: theme.typography.caption.fontFamily, color: theme.colors.text.secondary }]}>
                Live visual mapping is paused to save resources. Live calculations remain active.
              </Text>
            </View>
          </View>

          {/* Hero Metrics Card */}
          <View style={[styles.fallbackHeroCard, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle }]}>
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Clock size={22} color={theme.colors.brand.default} style={{ marginBottom: 4 }} />
                <Text style={[styles.metricLabel, { fontFamily: theme.typography.caption.fontFamily, color: theme.colors.text.secondary }]}>
                  ESTIMATED ARRIVAL
                </Text>
                <Text style={[styles.metricValue, { fontFamily: theme.typography.h1.fontFamily, color: theme.colors.text.primary }]}>
                  {etaText}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <NavigationArrow size={22} color={theme.colors.brand.default} style={{ marginBottom: 4 }} />
                <Text style={[styles.metricLabel, { fontFamily: theme.typography.caption.fontFamily, color: theme.colors.text.secondary }]}>
                  DISTANCE REMAINING
                </Text>
                <Text style={[styles.metricValue, { fontFamily: theme.typography.h1.fontFamily, color: theme.colors.text.primary }]}>
                  {distanceText}
                </Text>
              </View>
            </View>

            {donorDetails ? (
              <View style={[styles.donorFallbackInfo, { borderTopColor: theme.colors.border.subtle }]}>
                <View style={styles.donorInfoRow}>
                  <AvatarImage 
                    uri={donorDetails.avatar_url} 
                    size={40} 
                    style={{ marginRight: 12 }}
                  />
                  <View style={styles.donorMeta}>
                    <Text style={[styles.donorName, { fontFamily: theme.typography.h3.fontFamily, color: theme.colors.text.primary }]}>
                      {donorDetails.full_name}
                    </Text>
                    <Text style={[styles.donorStatusSub, { fontFamily: theme.typography.bodySm.fontFamily, color: theme.colors.text.secondary }]}>
                      {isEnRoute ? 'En-route to donation site' : 'Preparing details'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.fallbackCallBtn, { backgroundColor: theme.colors.brand.default, borderRadius: theme.radius.md }]}
                  onPress={handleCallDonor}
                  activeOpacity={0.8}
                >
                  <Phone size={18} color={theme.colors.text.onColor} weight="fill" />
                  <Text style={[styles.fallbackCallText, { fontFamily: theme.typography.body.fontFamily, color: theme.colors.text.onColor }]}>
                    Contact Donor
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.waitingDonorCard, { borderTopColor: theme.colors.border.subtle }]}>
                <Text style={[styles.waitingDonorText, { fontFamily: theme.typography.body.fontFamily, color: theme.colors.text.secondary }]}>
                  Waiting for donor details...
                </Text>
              </View>
            )}
          </View>

          {/* Stepper Timeline */}
          <View style={styles.stepperContainer}>
            <Text style={[styles.stepperTitle, { fontFamily: theme.typography.caption.fontFamily, color: theme.colors.text.secondary }]}>
              DISPATCH STATUS
            </Text>
            
            <View style={styles.stepItem}>
              <View style={styles.stepIndicatorCol}>
                <View style={[styles.stepDot, { backgroundColor: theme.colors.status.active }]} >
                  <CheckCircle size={14} color="#FFF" weight="fill" />
                </View>
                <View style={[styles.stepLine, { backgroundColor: theme.colors.status.active }]} />
              </View>
              <View style={styles.stepTextCol}>
                <Text style={[styles.stepNodeTitle, { fontFamily: theme.typography.body.fontFamily, color: theme.colors.text.primary }]}>
                  Donation Match Accepted
                </Text>
                <Text style={[styles.stepNodeDesc, { fontFamily: theme.typography.bodySm.fontFamily, color: theme.colors.text.secondary }]}>
                  A compatibility matching donor has agreed to fulfill your request.
                </Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepIndicatorCol}>
                <View style={[styles.stepDot, { backgroundColor: isEnRoute ? theme.colors.status.active : theme.colors.border.strong }]} >
                  {isEnRoute ? (
                    <Car size={12} color="#FFF" weight="fill" />
                  ) : (
                    <View style={styles.stepInnerDot} />
                  )}
                </View>
                <View style={[styles.stepLine, { backgroundColor: theme.colors.border.subtle }]} />
              </View>
              <View style={styles.stepTextCol}>
                <Text style={[styles.stepNodeTitle, { fontFamily: theme.typography.body.fontFamily, color: isEnRoute ? theme.colors.text.primary : theme.colors.text.tertiary }]}>
                  Donor En-Route
                </Text>
                <Text style={[styles.stepNodeDesc, { fontFamily: theme.typography.bodySm.fontFamily, color: theme.colors.text.secondary }]}>
                  {isEnRoute ? 'Donor is heading towards your destination.' : 'Awaiting location updates from donor device.'}
                </Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepIndicatorCol}>
                <View style={[styles.stepDot, { backgroundColor: theme.colors.border.subtle }]} >
                  <View style={styles.stepInnerDot} />
                </View>
              </View>
              <View style={styles.stepTextCol}>
                <Text style={[styles.stepNodeTitle, { fontFamily: theme.typography.body.fontFamily, color: theme.colors.text.tertiary }]}>
                  Arrival & Donation
                </Text>
                <Text style={[styles.stepNodeDesc, { fontFamily: theme.typography.bodySm.fontFamily, color: theme.colors.text.secondary }]}>
                  Donor arrives and completes verification checklist.
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : (
        // Interactive Mapbox View
        <View style={styles.mapContainer}>
          <Mapbox.MapView
            style={StyleSheet.absoluteFill}
            styleURL={theme.dark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street}
            logoEnabled={false}
            attributionEnabled={false}
            scaleBarEnabled={false}
          >
            <Mapbox.Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: requesterCoords 
                  ? [requesterCoords.longitude, requesterCoords.latitude]
                  : [90.4152, 23.7925],
                zoomLevel: 13,
              }}
            />

            {/* Requester destination Marker */}
            {requesterCoords && (
              <Mapbox.MarkerView id="requesterMarker" coordinate={[requesterCoords.longitude, requesterCoords.latitude]}>
                <View style={styles.requesterPinContainer}>
                  <View style={[styles.requesterPinBack, { backgroundColor: theme.colors.status.active + '20' }]} />
                  <View style={[styles.requesterPinCircle, { backgroundColor: theme.colors.status.active }]}>
                    {requestDetails.avatar_url ? (
                      <AvatarImage 
                        uri={requestDetails.avatar_url} 
                        size={24} 
                        borderWidth={0} 
                      />
                    ) : (
                      <Plus size={14} color="#FFF" weight="bold" />
                    )}
                  </View>
                </View>
              </Mapbox.MarkerView>
            )}

            {/* Donor live Marker */}
            {activeDonorCoords && (
              <Mapbox.MarkerView id="donorMarker" coordinate={[activeDonorCoords.longitude, activeDonorCoords.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.donorPinWrapper}>
                  <PulsingHalo />
                  <View style={[styles.donorPinCircle, { backgroundColor: theme.colors.brand.default }]}>
                    {donorDetails?.avatar_url ? (
                      <AvatarImage 
                        uri={donorDetails.avatar_url} 
                        size={20} 
                        borderWidth={0} 
                      />
                    ) : (
                      <Car size={16} color="#FFF" weight="fill" />
                    )}
                  </View>
                </View>
              </Mapbox.MarkerView>
            )}

            {/* Turn-by-turn road route polyline connecting donor and requester */}
            {requesterCoords && activeDonorCoords && (
              <Mapbox.ShapeSource
                id="routeSource"
                shape={{
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: routeCoordinates && routeCoordinates.length > 0 ? routeCoordinates : [
                      [activeDonorCoords.longitude, activeDonorCoords.latitude],
                      [requesterCoords.longitude, requesterCoords.latitude],
                    ],
                  },
                }}
              >
                {/* Background route line casing for contrast */}
                <Mapbox.LineLayer
                  id="routeLineCasing"
                  style={{
                    lineColor: theme.colors.brand.default,
                    lineWidth: 7,
                    lineOpacity: 0.35,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                {/* Foreground main route line */}
                <Mapbox.LineLayer
                  id="routeLineMain"
                  style={{
                    lineColor: theme.colors.brand.default,
                    lineWidth: 4,
                    lineOpacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </Mapbox.ShapeSource>
            )}
          </Mapbox.MapView>

          {/* Floating Actions */}
          <TouchableOpacity
            style={[styles.recenterBtn, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle }]}
            onPress={handleRecenter}
            activeOpacity={0.8}
          >
            <NavigationArrow size={18} color={theme.colors.text.primary} weight="fill" />
          </TouchableOpacity>

          {/* Interactive Floating Details Panel */}
          <View style={[styles.floatingPanel, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle }]}>
            <View style={styles.floatingPanelHeader}>
              <View style={styles.floatingPanelStatus}>
                <Clock size={16} color={theme.colors.brand.default} />
                <Text style={[styles.floatingEta, { fontFamily: theme.typography.h3.fontFamily, color: theme.colors.text.primary }]}>
                  {requesterCoords && activeDonorCoords ? `${etaText} • ${distanceText} away` : 'Calculating real-time ETA...'}
                </Text>
              </View>
              <Text style={[styles.floatingSubtitle, { fontFamily: theme.typography.bodySm.fontFamily, color: theme.colors.text.secondary }]}>
                {isEnRoute ? 'Donor is actively navigating to donation site' : 'Awaiting transit dispatch...'}
              </Text>
            </View>

            {donorDetails && (
              <View style={[styles.donorFloatingInfo, { borderTopColor: theme.colors.border.subtle }]}>
                <View style={styles.donorInfoRow}>
                  <AvatarImage 
                    uri={donorDetails.avatar_url} 
                    size={40} 
                    style={{ marginRight: 12 }}
                  />
                  <View style={styles.donorMeta}>
                    <Text style={[styles.donorName, { fontFamily: theme.typography.h3.fontFamily, color: theme.colors.text.primary }]}>
                      {donorDetails.full_name}
                    </Text>
                    <Text style={[styles.donorPhoneText, { fontFamily: theme.typography.bodySm.fontFamily, color: theme.colors.text.secondary }]}>
                      Matched Donor
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.floatingCallBtn, { backgroundColor: theme.colors.brand.default, borderRadius: theme.radius.md }]}
                  onPress={handleCallDonor}
                  activeOpacity={0.8}
                >
                  <Phone size={18} color={theme.colors.text.onColor} weight="fill" />
                  <Text style={[styles.floatingCallText, { fontFamily: theme.typography.body.fontFamily, color: theme.colors.text.onColor }]}>
                    Call
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  backButton: {
    height: 48,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  recenterBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 10,
  },
  floatingPanel: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  floatingPanelHeader: {
    marginBottom: 12,
  },
  floatingPanelStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  floatingEta: {
    fontSize: 18,
    fontWeight: '600',
  },
  floatingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  donorFloatingInfo: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  donorMeta: {
    flex: 1,
  },
  donorName: {
    fontSize: 15,
    fontWeight: '500',
  },
  donorPhoneText: {
    fontSize: 12,
    marginTop: 2,
  },
  floatingCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 40,
    gap: 6,
  },
  floatingCallText: {
    fontSize: 13,
    fontWeight: '500',
  },
  requesterPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  requesterPinBack: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  requesterPinCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  donorPinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  pulseHalo: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  donorPinCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  fallbackScroll: {
    flex: 1,
    padding: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
    alignItems: 'flex-start',
  },
  warningBannerText: {
    flex: 1,
  },
  warningBannerTitle: {
    fontWeight: '500',
    fontSize: 12,
  },
  warningBannerDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  fallbackHeroCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 2,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '600',
  },
  donorFallbackInfo: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  donorStatusSub: {
    fontSize: 13,
    marginTop: 2,
  },
  fallbackCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    marginTop: 16,
    gap: 8,
  },
  fallbackCallText: {
    fontSize: 14,
    fontWeight: '500',
  },
  waitingDonorCard: {
    borderTopWidth: 1,
    paddingTop: 16,
    alignItems: 'center',
  },
  waitingDonorText: {
    fontSize: 14,
  },
  stepperContainer: {
    paddingHorizontal: 4,
  },
  stepperTitle: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 16,
  },
  stepIndicatorCol: {
    alignItems: 'center',
    width: 24,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 40,
    marginVertical: 4,
  },
  stepTextCol: {
    flex: 1,
    paddingBottom: 24,
  },
  stepNodeTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  stepNodeDesc: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});
