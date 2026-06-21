import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  StatusBar,
  Modal,
  Platform,
  UIManager,
  LayoutAnimation,
  ActivityIndicator,
  DeviceEventEmitter,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { 
  ArrowLeft, 
  MapPin, 
  Sparkle, 
  CaretRight, 
  WarningCircle, 
  CrosshairSimple,
  CheckCircle,
  Clock,
  User,
  Users,
  Note,
  Plus,
  MagnifyingGlass,
  X,
} from 'phosphor-react-native';
import { useTheme } from '../../theme';
import CustomLoader from '../../components/CustomLoader';
import StaticMapFallback from '../../components/StaticMapFallback';
import { useMapStatus } from '../../hooks/useMapStatus';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function CreateRequestScreen() {
  const theme = useTheme();
  const router = useRouter();

  // Wizard Step Control
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [requestFor, setRequestFor] = useState<'ME' | 'SOMEONE_ELSE'>('ME');

  // Form Fields
  const [patientName, setPatientName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'CRITICAL'>('MEDIUM');
  const [unitsNeeded, setUnitsNeeded] = useState<number>(1);
  const [locationAddress, setLocationAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  // Loader & System States
  const [isLoading, setIsLoading] = useState(false);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Interactive Map picker states
  const [mapRegion, setMapRegion] = useState({
    latitude: 23.8103,
    longitude: 90.4125,
    zoom: 15
  });
  const { mapEnabled: remoteMapEnabled } = useMapStatus(false);
  const [mapEnabled, setMapEnabled] = useState(true);

  // Track map camera changes in a ref to avoid MapView re-rendering during dragging/zooming
  const tempCoordsRef = useRef({ latitude: 23.8103, longitude: 90.4125 });

  // Geolocation search states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  useEffect(() => {
    setMapEnabled(remoteMapEnabled);
  }, [remoteMapEnabled]);

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingLocation(true);
    try {
      const results = await Location.geocodeAsync(searchQuery.trim());
      if (results && results.length > 0) {
        const { latitude: resLat, longitude: resLng } = results[0];
        setMapRegion({
          latitude: resLat,
          longitude: resLng,
          zoom: 15
        });
        tempCoordsRef.current = {
          latitude: resLat,
          longitude: resLng
        };
      } else {
        Alert.alert('No Results', 'We could not locate that place. Try adding city/district names (e.g. Dhaka).');
      }
    } catch (e) {
      console.warn('Geocoding search query failed:', e);
      Alert.alert('Search Error', 'Failed to search for this location. Please check your internet connection.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // Load User Profile on mount
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (data && !error) {
            setUserProfile(data);
            // Default pre-fill
            setPatientName(data.full_name || '');
            setBloodGroup(data.blood_group || '');
          }
        }
      } catch (e) {
        console.warn('Failed to load profile details:', e);
      }
    }
    loadUserProfile();
  }, []);

  const handleRequestForChange = (choice: 'ME' | 'SOMEONE_ELSE') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRequestFor(choice);
    if (choice === 'ME' && userProfile) {
      setPatientName(userProfile.full_name || '');
      setBloodGroup(userProfile.blood_group || '');
    } else {
      setPatientName('');
      setBloodGroup('');
    }
  };

  // GPS centering handler
  const handleOpenMapPicker = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required to pin coordinates on the map.');
        setIsLoading(false);
        return;
      }

      let location = await Location.getLastKnownPositionAsync({});
      if (!location) {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }

      if (location) {
        setMapRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          zoom: 15
        });
        tempCoordsRef.current = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        };
      }
      setIsMapModalVisible(true);
    } catch (err) {
      console.warn('GPS center setup failed, defaulting coordinates:', err);
      setIsMapModalVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCameraChange = (event: any) => {
    const [lng, lat] = event.properties.center;
    tempCoordsRef.current = { latitude: lat, longitude: lng };
  };

  const handleConfirmPinLocation = async () => {
    const targetLat = tempCoordsRef.current.latitude;
    const targetLng = tempCoordsRef.current.longitude;
    setIsResolvingAddress(true);
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude: targetLat, longitude: targetLng });
      let formatted = '';
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        formatted = [
          addr.name,
          addr.street,
          addr.subregion || addr.district,
          addr.region || addr.city
        ].filter(Boolean).join(', ');
      }
      const finalAddress = formatted || `${targetLat.toFixed(5)}, ${targetLng.toFixed(5)}`;
      setLatitude(targetLat);
      setLongitude(targetLng);
      setLocationAddress(finalAddress);
      setIsMapModalVisible(false);
    } catch (e) {
      console.warn('Geocoding final coordinates failed:', e);
      const fallbackAddress = `${targetLat.toFixed(5)}, ${targetLng.toFixed(5)}`;
      setLatitude(targetLat);
      setLongitude(targetLng);
      setLocationAddress(fallbackAddress);
      setIsMapModalVisible(false);
    } finally {
      setIsResolvingAddress(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setStep(2);
    } else if (step === 2) {
      if (requestFor === 'SOMEONE_ELSE' && patientName.trim().length < 3) {
        Alert.alert('Validation Error', 'Patient name must be at least 3 characters.');
        return;
      }
      if (!bloodGroup) {
        Alert.alert('Validation Error', 'Please select the required blood group.');
        return;
      }
      if (!locationAddress) {
        Alert.alert('Validation Error', 'Please pin the donation destination coordinates.');
        return;
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setStep(3);
    }
  };

  const prevStep = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleSubmitRequest = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found.');

      // 1. Write blood request details to Supabase
      const { data: requestData, error: dbErr } = await supabase
        .from('blood_requests')
        .insert({
          patient_name: patientName.trim(),
          patient_blood_group: bloodGroup,
          urgency: urgency,
          units_needed: unitsNeeded,
          location_address: locationAddress,
          location_coords: { type: 'Point', coordinates: [longitude, latitude] },
          notes: notes.trim(),
          status: 'ACTIVE',
          requester_id: user.id
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      // 2. Invoke match-donors Edge Function
      const { error: invokeErr } = await supabase.functions.invoke('match-donors', {
        body: { requestId: requestData.id }
      });

      if (invokeErr) {
        console.warn('Matching algorithm Edge function invocation warnings:', invokeErr);
      }

      Alert.alert(
        'Request Published',
        `Blood request for ${bloodGroup} successfully created. Nearby compatible active donors are being scored and notified.`,
        [
          {
            text: 'View Map Panel',
            onPress: () => {
              DeviceEventEmitter.emit('profileUpdated');
              router.replace('/(tabs)/request');
            }
          }
        ]
      );
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Failed to submit blood request.');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar 
        barStyle={theme.dark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.bg.page} 
        translucent={false} 
      />

      {/* Top Header bar */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={step === 1 ? () => router.back() : prevStep} 
          disabled={isLoading}
        >
          <ArrowLeft size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Blood</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Premium visual step progress indicators */}
      <View style={styles.stepIndicatorContainer}>
        {(['Recipient', 'Details', 'Review'] as const).map((label, idx) => {
          const stepNum = idx + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <View key={label} style={styles.stepNode}>
              <View style={[
                styles.stepBadge,
                isActive && styles.stepBadgeActive,
                isDone && styles.stepBadgeDone
              ]}>
                {isDone ? (
                  <CheckCircle size={14} color="#FFF" weight="fill" />
                ) : (
                  <Text style={[
                    styles.stepBadgeText,
                    isActive && styles.stepBadgeTextActive
                  ]}>
                    {stepNum}
                  </Text>
                )}
              </View>
              <Text style={[
                styles.stepLabelText,
                isActive && styles.stepLabelTextActive
              ]}>
                {label}
              </Text>
              {idx < 2 && (
                <View style={[
                  styles.stepConnector,
                  isDone && styles.stepConnectorDone
                ]} />
              )}
            </View>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <CustomLoader message="Broadcasting matching invitations..." />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <View style={{ flex: 1 }}>
            <ScrollView 
              contentContainerStyle={styles.scrollContent} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* STEP 1: Who Needs Blood */}
              {step === 1 && (
                <View>
                  <Text style={styles.stepHeadline}>Who needs blood?</Text>
                  <Text style={styles.stepDescription}>
                    Choose whether you are requesting blood for yourself or a patient.
                  </Text>

                  <View style={styles.choiceGrid}>
                    <TouchableOpacity
                      style={[
                        styles.choiceCard,
                        requestFor === 'ME' && styles.choiceCardActive
                      ]}
                      onPress={() => handleRequestForChange('ME')}
                      activeOpacity={0.9}
                    >
                      <View style={styles.choiceHeader}>
                        <View style={[styles.choiceIconCircle, requestFor === 'ME' && styles.choiceIconCircleActive]}>
                          <User 
                            size={22} 
                            color={requestFor === 'ME' ? theme.colors.brand.default : theme.colors.text.secondary} 
                            weight={requestFor === 'ME' ? 'fill' : 'regular'} 
                          />
                        </View>
                        <View style={[styles.choiceRadio, requestFor === 'ME' && styles.choiceRadioActive]}>
                          {requestFor === 'ME' && <View style={styles.choiceRadioInner} />}
                        </View>
                      </View>
                      <Text style={[styles.choiceCardTitle, requestFor === 'ME' && styles.choiceCardTitleActive]}>
                        For myself
                      </Text>
                      <Text style={styles.choiceCardDesc}>
                        Pre-fills your profile details, name, and compatible blood group automatically.
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.choiceCard,
                        requestFor === 'SOMEONE_ELSE' && styles.choiceCardActive
                      ]}
                      onPress={() => handleRequestForChange('SOMEONE_ELSE')}
                      activeOpacity={0.9}
                    >
                      <View style={styles.choiceHeader}>
                        <View style={[styles.choiceIconCircle, requestFor === 'SOMEONE_ELSE' && styles.choiceIconCircleActive]}>
                          <Users 
                            size={22} 
                            color={requestFor === 'SOMEONE_ELSE' ? theme.colors.brand.default : theme.colors.text.secondary} 
                            weight={requestFor === 'SOMEONE_ELSE' ? 'fill' : 'regular'} 
                          />
                        </View>
                        <View style={[styles.choiceRadio, requestFor === 'SOMEONE_ELSE' && styles.choiceRadioActive]}>
                          {requestFor === 'SOMEONE_ELSE' && <View style={styles.choiceRadioInner} />}
                        </View>
                      </View>
                      <Text style={[styles.choiceCardTitle, requestFor === 'SOMEONE_ELSE' && styles.choiceCardTitleActive]}>
                        For someone else
                      </Text>
                      <Text style={styles.choiceCardDesc}>
                        Enter custom patient name, required blood group, and set details.
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 2: Details */}
              {step === 2 && (
                <View>
                  <Text style={styles.stepHeadline}>Enter details</Text>
                  <Text style={styles.stepDescription}>
                    Fill patient details, location coordinates, and blood units.
                  </Text>

                  <View style={styles.formCard}>
                    {/* Patient Name (Only for someone else) */}
                    {requestFor === 'SOMEONE_ELSE' && (
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Patient Name</Text>
                        <TextInput
                          style={styles.textInput}
                          value={patientName}
                          onChangeText={setPatientName}
                          placeholder="Enter patient full name"
                          placeholderTextColor={theme.colors.text.tertiary}
                        />
                      </View>
                    )}

                    {/* Blood Group Grid Chips (4x2 layout) */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Required Blood Group</Text>
                      <View style={styles.bloodChipsGrid}>
                        {BLOOD_GROUPS.map((group) => {
                          const isSelected = bloodGroup === group;
                          return (
                            <TouchableOpacity
                              key={group}
                              style={[
                                styles.bloodChip,
                                isSelected && styles.bloodChipActive
                              ]}
                              onPress={() => setBloodGroup(group)}
                              activeOpacity={0.8}
                            >
                              <Text style={[
                                styles.bloodChipText,
                                isSelected && styles.bloodChipTextActive
                              ]}>
                                {group}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Stepper for Units Needed (Capsule UI) */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Blood Units Needed</Text>
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={[styles.stepperBtn, unitsNeeded <= 1 && styles.stepperBtnDisabled]}
                          disabled={unitsNeeded <= 1}
                          onPress={() => setUnitsNeeded(prev => Math.max(1, prev - 1))}
                        >
                          <Text style={[styles.stepperBtnText, { color: theme.colors.text.primary }]}>−</Text>
                        </TouchableOpacity>
                        
                        <Text style={styles.stepperValueText}>
                          {unitsNeeded} {unitsNeeded === 1 ? 'Bag' : 'Bags'}
                        </Text>

                        <TouchableOpacity
                          style={[styles.stepperBtn, unitsNeeded >= 6 && styles.stepperBtnDisabled]}
                          disabled={unitsNeeded >= 6}
                          onPress={() => setUnitsNeeded(prev => Math.min(6, prev + 1))}
                        >
                          <Text style={[styles.stepperBtnText, { color: theme.colors.text.primary }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* High fidelity Map Pinning Card */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Hospital / Location</Text>
                      
                      <TouchableOpacity 
                        style={[
                          styles.mapSelectorCard,
                          locationAddress ? styles.mapSelectorCardSelected : null
                        ]} 
                        onPress={handleOpenMapPicker}
                        activeOpacity={0.8}
                      >
                        <View style={styles.mapSelectorIconWrapper}>
                          <MapPin size={22} color={locationAddress ? theme.colors.brand.default : theme.colors.text.secondary} weight="fill" />
                        </View>
                        <View style={styles.mapSelectorContent}>
                          {locationAddress ? (
                            <>
                              <Text style={styles.mapSelectorTitleSelected}>Location Pinned</Text>
                              <Text style={styles.mapSelectorAddress} numberOfLines={2}>{locationAddress}</Text>
                              <Text style={styles.mapSelectorCoords}>
                                Coords: {latitude?.toFixed(5)}, {longitude?.toFixed(5)}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text style={styles.mapSelectorTitle}>Set Destination Point</Text>
                              <Text style={styles.mapSelectorSub}>Tap to open map and pin exact coordinates</Text>
                            </>
                          )}
                        </View>
                        <View style={styles.mapSelectorChevron}>
                          <CaretRight size={16} color={theme.colors.text.tertiary} weight="bold" />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Urgency segmented control */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Urgency level</Text>
                      <View style={styles.urgencySegmentRow}>
                        {(['LOW', 'MEDIUM', 'CRITICAL'] as const).map((level) => {
                          const isSelected = urgency === level;
                          let dotColor = theme.colors.text.tertiary;
                          let activeBg = theme.colors.bg.page;
                          let activeBorder = theme.colors.border.default;
                          let activeText = theme.colors.text.secondary;

                          if (level === 'LOW') {
                            dotColor = theme.colors.status.info;
                            if (isSelected) {
                              activeBg = theme.colors.status.infoBg;
                              activeBorder = theme.colors.status.infoText;
                              activeText = theme.colors.status.infoText;
                            }
                          } else if (level === 'MEDIUM') {
                            dotColor = theme.colors.status.pending;
                            if (isSelected) {
                              activeBg = theme.colors.status.pendingBg;
                              activeBorder = theme.colors.status.pendingText;
                              activeText = theme.colors.status.pendingText;
                            }
                          } else if (level === 'CRITICAL') {
                            dotColor = theme.colors.status.critical;
                            if (isSelected) {
                              activeBg = theme.colors.status.criticalBg;
                              activeBorder = theme.colors.status.criticalText;
                              activeText = theme.colors.status.criticalText;
                            }
                          }

                          return (
                            <TouchableOpacity
                              key={level}
                              style={[
                                styles.urgencySegment,
                                isSelected && { backgroundColor: activeBg, borderColor: activeBorder }
                              ]}
                              onPress={() => setUrgency(level)}
                              activeOpacity={0.8}
                            >
                              <View style={styles.urgencyContent}>
                                <View style={[styles.urgencyDot, { backgroundColor: dotColor }]} />
                                <Text style={[
                                  styles.urgencySegmentText,
                                  isSelected && { color: activeText, fontWeight: '600' }
                                ]}>
                                  {level}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Critical urgency panic notice */}
                      {urgency === 'CRITICAL' && (
                        <View style={styles.criticalNotice}>
                          <WarningCircle size={18} color={theme.colors.brand.default} weight="fill" />
                          <Text style={styles.criticalNoticeText}>
                            Panic Broadcast Mode: Scans up to a 10 km geofence radius and dispatches high-priority push notifications to compatible candidates.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Notes Field */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Additional Notes (Max 200 chars)</Text>
                      <View style={styles.notesContainer}>
                        <TextInput
                          style={[styles.textInput, styles.textArea]}
                          value={notes}
                          onChangeText={setNotes}
                          maxLength={200}
                          multiline
                          placeholder="Include hospital building, floor, room number or special guidance..."
                          placeholderTextColor={theme.colors.text.tertiary}
                        />
                        <Text style={styles.charCounter}>{notes.length}/200</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* STEP 3: Review & Publish */}
              {step === 3 && (
                <View>
                  <Text style={styles.stepHeadline}>Review & send</Text>
                  <Text style={styles.stepDescription}>
                    Please review the parameters of the request before sending it.
                  </Text>

                  <View style={styles.reviewCard}>
                    <View style={styles.reviewHeaderRow}>
                      <View style={styles.reviewBloodBadge}>
                        <Text style={styles.reviewBloodText}>{bloodGroup}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={styles.reviewTitle}>Patient: {patientName}</Text>
                        <Text style={styles.reviewSubtitle}>
                          Requested for: {requestFor === 'ME' ? 'Myself' : 'Someone Else'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reviewDivider} />

                    {/* Info items */}
                    <View style={styles.reviewInfoItem}>
                      <View style={styles.reviewIconCircle}>
                        <Clock size={18} color={theme.colors.brand.default} weight="fill" />
                      </View>
                      <View style={{ marginLeft: 16, flex: 1 }}>
                        <Text style={styles.reviewLabel}>BLOOD AMOUNT</Text>
                        <Text style={styles.reviewValue}>{unitsNeeded} {unitsNeeded === 1 ? 'Bag' : 'Bags'}</Text>
                      </View>
                    </View>

                    <View style={styles.reviewInfoItem}>
                      <View style={styles.reviewIconCircle}>
                        <MapPin size={18} color={theme.colors.brand.default} weight="fill" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={styles.reviewLabel}>DONATION DESTINATION</Text>
                        <Text style={styles.reviewValue} numberOfLines={2}>{locationAddress}</Text>
                        <Text style={styles.reviewSubValue}>
                          Coords: {latitude?.toFixed(5)}, {longitude?.toFixed(5)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reviewInfoItem}>
                      <View style={styles.reviewIconCircle}>
                        <WarningCircle size={18} color={theme.colors.brand.default} weight="fill" />
                      </View>
                      <View style={{ marginLeft: 16, flex: 1 }}>
                        <Text style={styles.reviewLabel}>URGENCY CLASS</Text>
                        <Text style={[
                          styles.reviewValue, 
                          urgency === 'CRITICAL' && { color: theme.colors.status.criticalText, fontWeight: '600' }
                        ]}>
                          {urgency} URGENCY
                        </Text>
                      </View>
                    </View>

                    {notes ? (
                      <View style={styles.reviewInfoItem}>
                        <View style={styles.reviewIconCircle}>
                          <Note size={18} color={theme.colors.brand.default} weight="fill" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 16 }}>
                          <Text style={styles.reviewLabel}>ADDITIONAL GUIDANCE</Text>
                          <Text style={styles.reviewNotes}>"{notes}"</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Final Submission Card */}
                  <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitRequest} activeOpacity={0.85}>
                    <Sparkle size={18} color={theme.colors.text.onColor} weight="fill" />
                    <Text style={styles.submitBtnText}>PUBLISH & BROADCAST MATCHES</Text>
                  </TouchableOpacity>

                  <Text style={[
                    styles.geofenceNoticeText,
                    urgency === 'CRITICAL' && { color: theme.colors.status.criticalText }
                  ]}>
                    {urgency === 'CRITICAL' 
                      ? '* Broadcast covers all compatible active donors in a 10 km geofence radius.' 
                      : '* Broadcast covers all compatible active donors in a 5 km geofence radius.'
                    }
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Persistent Floating Step Footer Button */}
            {step < 3 && (
              <View style={[styles.footerBar, { borderTopColor: theme.colors.border.subtle }]}>
                <TouchableOpacity style={styles.nextCtaBtn} onPress={nextStep} activeOpacity={0.85}>
                  <Text style={styles.nextCtaText}>Continue</Text>
                  <CaretRight size={16} color="#FFF" weight="bold" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Map Picker Modal Overlay */}
      <Modal visible={isMapModalVisible} animationType="slide">
        <SafeAreaView style={styles.modalMapScreen} edges={['top', 'bottom']}>
          {/* Map Top Header */}
          <View style={styles.mapHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setIsMapModalVisible(false)}>
              <ArrowLeft size={20} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Position Destination Pin</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Location Search Bar Section */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBarWrapper}>
              <MagnifyingGlass size={18} color={theme.colors.text.secondary} />
              <TextInput
                style={styles.searchBarInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search hospital or area..."
                placeholderTextColor={theme.colors.text.tertiary}
                returnKeyType="search"
                onSubmitEditing={handleSearchLocation}
                autoCorrect={false}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity 
              style={styles.searchBtn} 
              onPress={handleSearchLocation}
              disabled={isSearchingLocation}
              activeOpacity={0.85}
            >
              {isSearchingLocation ? (
                <ActivityIndicator size="small" color={theme.colors.text.onColor} />
              ) : (
                <Text style={styles.searchBtnText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Interactive Mapbox Map */}
          {mapEnabled ? (
            <View style={styles.mapWrapper}>
              <Mapbox.MapView 
                style={StyleSheet.absoluteFill} 
                logoEnabled={false} 
                attributionEnabled={false}
                onCameraChanged={handleCameraChange}
              >
                <Mapbox.Camera
                  zoomLevel={mapRegion.zoom}
                  centerCoordinate={[mapRegion.longitude, mapRegion.latitude]}
                  animationDuration={0}
                />
              </Mapbox.MapView>

              {/* Central Non-Moving Crosshair Pin Overlay */}
              <View style={styles.crosshairWrapper} pointerEvents="none">
                <MapPin size={38} color={theme.colors.brand.default} weight="fill" />
                <View style={styles.crosshairDot} />
              </View>

              {/* Float Re-center Action */}
              <TouchableOpacity 
                style={styles.recenterFloatBtn}
                onPress={async () => {
                  try {
                    const loc = await Location.getCurrentPositionAsync({});
                    if (loc) {
                      setMapRegion({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, zoom: 15 });
                      tempCoordsRef.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                    }
                  } catch (e) {
                    console.log('re-center error:', e);
                  }
                }}
              >
                <CrosshairSimple size={20} color={theme.colors.text.primary} weight="bold" />
              </TouchableOpacity>
            </View>
          ) : (
             <StaticMapFallback onClose={() => setIsMapModalVisible(false)} />
          )}

          {/* Map Bottom Confirmation Bar */}
          <View style={styles.mapConfirmPanel}>
            <View style={styles.mapConfirmInstruction}>
              <MapPin size={18} color={theme.colors.brand.default} weight="fill" />
              <Text style={styles.mapConfirmInstructionText}>
                Align the pin precisely over the destination on the map.
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.confirmBtn, isResolvingAddress && styles.disabledBtn]} 
              disabled={isResolvingAddress}
              onPress={handleConfirmPinLocation}
              activeOpacity={0.85}
            >
              {isResolvingAddress ? (
                <View style={styles.resolvingRow}>
                  <ActivityIndicator size="small" color={theme.colors.text.onColor} />
                  <Text style={[styles.confirmBtnText, { color: theme.colors.text.onColor }]}>
                    RESOLVING ADDRESS...
                  </Text>
                </View>
              ) : (
                <>
                  <CheckCircle size={18} color={theme.colors.text.onColor} weight="fill" />
                  <Text style={styles.confirmBtnText}>CONFIRM PIN LOCATION</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.page,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: theme.colors.bg.page,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 18,
    color: theme.colors.text.primary,
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.bg.surface,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  stepNode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.page,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  stepBadgeActive: {
    borderColor: theme.colors.brand.default,
    backgroundColor: theme.colors.brand.subtle,
  },
  stepBadgeDone: {
    borderColor: theme.colors.status.active,
    backgroundColor: theme.colors.status.active,
  },
  stepBadgeText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  stepBadgeTextActive: {
    color: theme.colors.brand.text,
  },
  stepLabelText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  stepLabelTextActive: {
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  stepConnector: {
    height: 2,
    backgroundColor: theme.colors.border.subtle,
    width: 24,
    marginHorizontal: 8,
  },
  stepConnectorDone: {
    backgroundColor: theme.colors.status.active,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  stepHeadline: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 22,
    color: theme.colors.text.primary,
    marginBottom: 6,
  },
  stepDescription: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  choiceGrid: {
    gap: 16,
    marginTop: 8,
  },
  choiceCard: {
    backgroundColor: theme.colors.bg.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border.subtle,
    ...theme.shadows.elevation1,
  },
  choiceCardActive: {
    borderColor: theme.colors.brand.default,
    backgroundColor: theme.colors.brand.subtle,
    shadowColor: theme.colors.brand.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  choiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  choiceRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: theme.colors.border.strong,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.page,
  },
  choiceRadioActive: {
    borderColor: theme.colors.brand.default,
  },
  choiceRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.brand.default,
  },
  choiceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceIconCircleActive: {
    backgroundColor: 'rgba(230, 48, 48, 0.12)',
  },
  choiceCardTitle: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: 16,
    color: theme.colors.text.primary,
    marginBottom: 6,
  },
  choiceCardTitleActive: {
    color: theme.colors.brand.text,
  },
  choiceCardDesc: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: theme.colors.bg.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    color: theme.colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  textInput: {
    height: 52,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.bg.page,
  },
  notesContainer: {
    position: 'relative',
  },
  textArea: {
    height: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
    paddingBottom: 20,
  },
  charCounter: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    color: theme.colors.text.tertiary,
  },
  bloodChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  bloodChip: {
    width: '23%',
    height: 44,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.page,
  },
  bloodChipActive: {
    backgroundColor: theme.colors.brand.default,
    borderColor: theme.colors.brand.default,
  },
  bloodChipText: {
    fontFamily: theme.typography.blood.fontFamily,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  bloodChipTextActive: {
    color: theme.colors.text.onColor,
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.page,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    padding: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  stepperValueText: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: 15,
    color: theme.colors.text.primary,
    paddingHorizontal: 16,
    textAlign: 'center',
    minWidth: 80,
  },
  mapSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.page,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginTop: 4,
  },
  mapSelectorCardSelected: {
    borderColor: theme.colors.brand.default,
    backgroundColor: theme.colors.brand.subtle,
  },
  mapSelectorIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mapSelectorContent: {
    flex: 1,
  },
  mapSelectorTitle: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: 15,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  mapSelectorTitleSelected: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: 14,
    color: theme.colors.brand.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  mapSelectorSub: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 12,
    color: theme.colors.text.secondary,
    lineHeight: 16,
  },
  mapSelectorAddress: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.text.primary,
    lineHeight: 18,
  },
  mapSelectorCoords: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    color: theme.colors.text.tertiary,
    marginTop: 4,
  },
  mapSelectorChevron: {
    marginLeft: 8,
  },
  urgencySegmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  urgencySegment: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.page,
  },
  urgencyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  urgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  urgencySegmentText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  criticalNotice: {
    flexDirection: 'row',
    backgroundColor: theme.colors.brand.subtle,
    padding: 12,
    borderRadius: theme.radius.md,
    gap: 8,
    marginTop: 12,
  },
  criticalNoticeText: {
    flex: 1,
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 12,
    color: theme.colors.brand.text,
    lineHeight: 16,
  },
  reviewCard: {
    backgroundColor: theme.colors.bg.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    borderWidth: 1.5,
    borderColor: theme.colors.border.subtle,
    ...theme.shadows.elevation2,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewBloodBadge: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brand.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewBloodText: {
    fontFamily: theme.typography.blood.fontFamily,
    fontSize: 18,
    color: '#FFF',
  },
  reviewTitle: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  reviewSubtitle: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  reviewDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderStyle: 'dashed',
    marginVertical: 20,
  },
  reviewInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.brand.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    color: theme.colors.text.secondary,
    letterSpacing: 0.5,
  },
  reviewValue: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  reviewSubValue: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    color: theme.colors.text.tertiary,
    marginTop: 2,
  },
  reviewNotes: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 2,
  },
  submitBtn: {
    height: 52,
    backgroundColor: theme.colors.brand.default,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  submitBtnText: {
    fontFamily: theme.typography.bodyLg.fontFamily,
    fontSize: 14,
    color: '#FFF',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  geofenceNoticeText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
  footerBar: {
    padding: 16,
    backgroundColor: theme.colors.bg.surface,
    borderTopWidth: 1,
  },
  nextCtaBtn: {
    height: 50,
    backgroundColor: theme.colors.brand.default,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  nextCtaText: {
    fontFamily: theme.typography.bodyLg.fontFamily,
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  modalMapScreen: {
    flex: 1,
    backgroundColor: theme.colors.bg.page,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  crosshairWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -19 }, { translateY: -38 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000',
    marginTop: -4,
  },
  recenterFloatBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.bg.surface,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  mapConfirmPanel: {
    backgroundColor: theme.colors.bg.surface,
    borderTopWidth: 1,
    borderColor: theme.colors.border.subtle,
    padding: 20,
  },
  mapConfirmInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  mapConfirmInstructionText: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  confirmBtn: {
    height: 50,
    backgroundColor: theme.colors.brand.default,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontFamily: theme.typography.bodyLg.fontFamily,
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  resolvingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.bg.surface,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.subtle,
    gap: 10,
  },
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.page,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchBarInput: {
    flex: 1,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.text.primary,
    padding: 0,
  },
  searchBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.brand.default,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  searchBtnText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 13,
    color: theme.colors.text.onColor,
    fontWeight: '600',
  },
});
