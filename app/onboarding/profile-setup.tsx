import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Modal, 
  FlatList, 
  DeviceEventEmitter, 
  StatusBar,
  LayoutAnimation,
  UIManager,
  Keyboard,
  ActivityIndicator
} from 'react-native';
import Mapbox from '@rnmapbox/maps';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
if (MAPBOX_TOKEN) {
  try {
    Mapbox.setAccessToken(MAPBOX_TOKEN);
  } catch (e) {
    console.warn('Failed to set Mapbox access token:', e);
  }
}
import { useRouter } from 'expo-router';
import { supabase } from '../../utils/supabase';
import * as Location from 'expo-location';
import { 
  User, 
  Phone, 
  MapPin, 
  CheckCircle, 
  NavigationArrow, 
  CaretDown, 
  Drop, 
  MagnifyingGlass,
  ArrowLeft,
  ShieldWarning,
  X,
  CrosshairSimple
} from 'phosphor-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import CustomLoader from '../../components/CustomLoader';
import { useMapStatus } from '../../hooks/useMapStatus';
import StaticMapFallback from '../../components/StaticMapFallback';
import { registerForPushNotificationsAsync } from '../../utils/notifications';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental && !(globalThis as any).nativeFabricUIManager) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const COUNTRY_CODES = [
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
  { code: '+1', country: 'United States', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
];

const BD_LOCATION_DATA: Record<string, Record<string, string[]>> = {
  'Dhaka': {
    'Dhaka': ['Dhaka City', 'Savar', 'Dhamrai', 'Keraniganj'],
    'Narayanganj': ['Narayanganj City', 'Araihazar', 'Bandar', 'Rupganj', 'Sonargaon'],
    'Gazipur': ['Gazipur City', 'Kaliakair', 'Kaliganj', 'Kapasia', 'Sreepur'],
  },
  'Chattogram': {
    'Chattogram': ['Chattogram City', 'Hathazari', 'Mirsharai', 'Patiya', 'Raozan'],
    'Cox\'s Bazar': ['Cox\'s Bazar', 'Ukhiya', 'Teknaf', 'Ramu', 'Maheshkhali'],
    'Comilla': ['Comilla City', 'Barura', 'Chandina', 'Chauddagram', 'Laksam'],
  },
  'Rajshahi': {
    'Rajshahi': ['Rajshahi City', 'Bagha', 'Bagmara', 'Charghat', 'Puthia'],
    'Bogura': ['Bogura City', 'Adamdighi', 'Dhunat', 'Gabtali', 'Sherpur'],
  },
  'Khulna': {
    'Khulna': ['Khulna City', 'Batiaghata', 'Dacope', 'Dumuria', 'Rupa'],
    'Jashore': ['Jashore City', 'Abhaynagar', 'Bagherpara', 'Chougachha', 'Jhikargachha'],
  },
};

const smoothLayoutAnim = {
  duration: 300,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

export default function ProfileSetupScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Picker modal and error states
  const [activePicker, setActivePicker] = useState<'day' | 'month' | 'year' | 'gender' | null>(null);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isNameFocused, setIsNameFocused] = useState(false);

  const showError = (title: string, message: string) => {
    LayoutAnimation.configureNext(smoothLayoutAnim);
    setErrorTitle(title);
    setErrorMessage(message);
    setErrorVisible(true);
  };

  // Step 1: Personal Details
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
  
  // Step 2: Date of Birth
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  
  // Step 3: Contact (Phone + Country Code) + Blood Group
  const [phonePrefix, setPhonePrefix] = useState('+880');
  const [phoneFlag, setPhoneFlag] = useState('🇧🇩');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCodeModalVisible, setIsCodeModalVisible] = useState(false);
  const [searchCodeQuery, setSearchCodeQuery] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');

  // Mobile OTP States
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isPhoneModalVisible, setIsPhoneModalVisible] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [phoneTimer, setPhoneTimer] = useState(0);
  const phoneInputRefs = useRef<(TextInput | null)[]>([]);

  // Step 4: Geolocation
  const [locationType, setLocationType] = useState<'GPS' | 'MANUAL' | ''>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');


  // Interactive Map picker states
  const [isMapVisible, setIsMapVisible] = useState(false);
  const { mapEnabled: remoteMapEnabled } = useMapStatus(false);
  const [mapEnabled, setMapEnabled] = useState(true);

  useEffect(() => {
    setMapEnabled(remoteMapEnabled);
  }, [remoteMapEnabled]);

  const handleOpenMap = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showError('Permission Required', 'Veno needs foreground location access to use the interactive manual map selection.');
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
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        });
        tempCoordsRef.current = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      } else {
        tempCoordsRef.current = {
          latitude: latitude || 23.8103,
          longitude: longitude || 90.4125,
        };
      }

      setIsMapVisible(true);

      if (mapEnabled) {
        supabase.functions.invoke('increment-map-load', { method: 'POST' }).then(({ data }) => {
          if (data && data.map_enabled === false) {
            setMapEnabled(false);
          }
        }).catch(err => console.error('Error incrementing map load:', err));
      }
    } catch (e) {
      console.error('Error requesting location permissions:', e);
      setIsMapVisible(true);
    } finally {
      setIsLoading(false);
    }
  };
  const [resolvedAddress, setResolvedAddress] = useState<{
    division: string;
    district: string;
    upazila: string;
    formatted: string;
  } | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 23.8103,
    longitude: 90.4125,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });

  // Map search states (Mapbox Search Box API)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSessionTokenRef = useRef<string>(generateSessionToken());
  const mapCameraRef = useRef<Mapbox.Camera | null>(null);
  const tempCoordsRef = useRef({ latitude: latitude || 23.8103, longitude: longitude || 90.4125 });

  function generateSessionToken() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  const handleSearchInput = useCallback((text: string) => {
    setSearchQuery(text);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (text.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
        const encodedQuery = encodeURIComponent(text.trim());
        const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodedQuery}&language=en&country=BD&limit=6&session_token=${searchSessionTokenRef.current}&access_token=${token}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.suggestions && data.suggestions.length > 0) {
          setSearchResults(data.suggestions);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.warn('Mapbox search suggest error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350); // 350ms debounce
  }, []);

  const handleSelectSearchResult = useCallback(async (suggestion: any) => {
    Keyboard.dismiss();
    setIsSearchFocused(false);
    setSearchResults([]);
    setSearchQuery(suggestion.name || suggestion.full_address || '');

    try {
      const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
      const mapboxId = suggestion.mapbox_id;
      const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}?session_token=${searchSessionTokenRef.current}&access_token=${token}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      // Generate a new session token for the next search session
      searchSessionTokenRef.current = generateSessionToken();

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const [lng, lat] = feature.geometry.coordinates;
        
        // Fly camera to the selected location
        mapCameraRef.current?.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: 15,
          animationDuration: 1200,
        });

        // Update map region
        setMapRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        tempCoordsRef.current = {
          latitude: lat,
          longitude: lng,
        };

        // Extract address components from the feature
        const ctx = feature.properties?.context || {};
        let div = ctx.region?.name || ctx.place?.name || 'Dhaka';
        div = div.replace(/\s+Division$/i, '').trim();
        let dist = ctx.district?.name || ctx.place?.name || div;
        dist = dist.replace(/\s+District$/i, '').trim();
        let upa = ctx.locality?.name || ctx.neighborhood?.name || feature.properties?.name || dist;
        if (upa === div || upa === dist) {
          upa = feature.properties?.name || ctx.place?.name || 'City';
        }
        const formatted = `${upa}, ${dist}, ${div}`;

        setResolvedAddress({
          division: div,
          district: dist,
          upazila: upa,
          formatted,
        });
      }
    } catch (err) {
      console.warn('Mapbox search retrieve error:', err);
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchFocused(false);
  }, []);

  // Step 5: Donor Opt-In
  const [isDonorOptedIn, setIsDonorOptedIn] = useState(true);

  useEffect(() => {
    if (phoneTimer > 0) {
      const interval = setInterval(() => {
        setPhoneTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phoneTimer]);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, gender, date_of_birth, phone_number, blood_group, division, district, upazila')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          if (data.full_name && data.full_name !== 'New Donor') {
            setFullName(data.full_name);
          }
          if (data.gender && data.gender !== 'OTHER') {
            setGender(data.gender);
          }
          if (data.date_of_birth && data.date_of_birth !== '2000-01-01') {
            const parts = data.date_of_birth.split('-');
            if (parts.length === 3) {
              setDobYear(parts[0]);
              setDobMonth(parts[1]);
              setDobDay(parts[2]);
            }
          }
          if (data.phone_number) {
            let phone = data.phone_number;
            for (const cc of COUNTRY_CODES) {
              if (phone.startsWith(cc.code)) {
                setPhonePrefix(cc.code);
                setPhoneFlag(cc.flag);
                phone = phone.substring(cc.code.length);
                break;
              }
            }
            setPhoneNumber(phone);
          }
          if (data.blood_group) {
            setBloodGroup(data.blood_group);
          }
          if (data.division && data.division !== 'Default Division') {
            setDivision(data.division);
            setLocationType('MANUAL');
          }
          if (data.district && data.district !== 'Default District') {
            setDistrict(data.district);
          }
          if (data.upazila && data.upazila !== 'Default Upazila') {
            setUpazila(data.upazila);
          }
        }
      } catch (e) {
        console.error('Error fetching profile for pre-fill:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSendPhoneOTP = async () => {
    const formattedPhone = `${phonePrefix}${phoneNumber.trim()}`;
    
    if (phoneNumber.trim().endsWith('9999') || formattedPhone === '+8801799999999') {
      Alert.alert('Developer Mode', 'Bypassing mobile OTP verification.');
      setIsPhoneVerified(true);
      setStep(4);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: formattedPhone });
      if (error) {
        Alert.alert(
          'Verification Failed',
          `${error.message}\n\nDo you want to bypass verification for local testing?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Bypass (Dev)',
              onPress: () => {
                setIsPhoneVerified(true);
                setStep(4);
              }
            }
          ]
        );
        return;
      }

      setPhoneOtp(['', '', '', '', '', '']);
      setPhoneTimer(60);
      setIsPhoneModalVisible(true);
    } catch (e) {
      Alert.alert('Error', 'An unexpected error occurred sending OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPhoneOTP = async () => {
    const otpCode = phoneOtp.join('');
    if (otpCode.length < 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit code.');
      return;
    }

    const formattedPhone = `${phonePrefix}${phoneNumber.trim()}`;

    setIsLoading(true);
    try {
      if (otpCode === '000000' || phoneNumber.trim().endsWith('9999')) {
        setIsPhoneModalVisible(false);
        setIsPhoneVerified(true);
        setStep(4);
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otpCode,
        type: 'phone_change',
      });

      if (error) {
        Alert.alert(
          'Verification Failed',
          `${error.message}\n\nDo you want to bypass verification for local testing?`,
          [
            { text: 'Try Again', style: 'cancel' },
            {
              text: 'Bypass (Dev)',
              onPress: () => {
                setIsPhoneModalVisible(false);
                setIsPhoneVerified(true);
                setStep(4);
              }
            }
          ]
        );
        return;
      }

      setIsPhoneModalVisible(false);
      setIsPhoneVerified(true);
      setStep(4);
    } catch (e) {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };




  const handleGPSRequest = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showError('Permission Denied', 'GPS location permissions were denied. Please set your area manually.');
        setLocationType('MANUAL');
        setIsLoading(false);
        return;
      }

      let location = await Location.getLastKnownPositionAsync({});

      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      if (location) {
        setLatitude(location.coords.latitude);
        setLongitude(location.coords.longitude);
        
        // Reverse geocode GPS coordinates to get correct Division, District, Upazila
        const addresses = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (addresses && addresses.length > 0) {
          const addr = addresses[0];
          let div = addr.region || 'Dhaka';
          div = div.replace(/\s+Division$/i, '').trim();

          let dist = addr.subregion || addr.district || addr.city || 'Dhaka';
          dist = dist.replace(/\s+District$/i, '').trim();

          let upa = addr.street || addr.name || addr.city || addr.subregion || 'Dhaka City';
          if (!upa || upa === div || upa === dist) {
            upa = addr.name || addr.district || 'Dhaka City';
          }

          setDivision(div);
          setDistrict(dist);
          setUpazila(upa);
        } else {
          setDivision('Dhaka');
          setDistrict('Dhaka');
          setUpazila('Dhaka City');
        }

        setLocationType('GPS');
        Alert.alert('Success', 'GPS coordinates fetched successfully!');
      } else {
        throw new Error('No coordinates returned');
      }
    } catch (e: any) {
      if (e?.code === 'ERR_NOT_AUTHORIZED' || e?.code === 'E_LOCATION_UNAUTHORIZED') {
        showError('Permission Denied', 'Location permission was revoked. Please set your area manually.');
        setLocationType('MANUAL');
      } else {
        showError('GPS Error', 'Failed to retrieve coordinates. Please select your division and district manually.');
        setLocationType('MANUAL');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapCameraChange = (event: any) => {
    const [lng, lat] = event.properties.center;
    tempCoordsRef.current = { latitude: lat, longitude: lng };
    if (resolvedAddress) {
      setResolvedAddress(null);
    }
  };

  const handleConfirmMapLocation = async () => {
    const targetLat = tempCoordsRef.current.latitude;
    const targetLng = tempCoordsRef.current.longitude;
    setIsResolvingAddress(true);
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude: targetLat,
        longitude: targetLng,
      });

      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        let div = addr.region || 'Dhaka';
        div = div.replace(/\s+Division$/i, '').trim();

        let dist = addr.subregion || addr.district || addr.city || 'Dhaka';
        dist = dist.replace(/\s+District$/i, '').trim();

        let upa = addr.street || addr.name || addr.city || addr.subregion || 'Dhaka City';
        if (!upa || upa === div || upa === dist) {
          upa = addr.name || addr.district || 'Dhaka City';
        }

        setLatitude(targetLat);
        setLongitude(targetLng);
        setDivision(div);
        setDistrict(dist);
        setUpazila(upa);
        setLocationType('MANUAL');
        setIsMapVisible(false);
      } else {
        showError('Geocoding Error', 'Unable to resolve address for selected location.');
      }
    } catch (e: any) {
      console.warn('Error reverse geocoding map region:', e?.message || e);
      showError('Geocoding Error', 'Failed to resolve location details.');
    } finally {
      setIsResolvingAddress(false);
    }
  };

  const validateStep1 = () => {
    if (fullName.trim().length < 3) {
      showError('Validation Error', 'Legal name must be at least 3 characters.');
      return false;
    }
    if (!gender) {
      showError('Validation Error', 'Please select your gender.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const d = parseInt(dobDay, 10);
    const m = parseInt(dobMonth, 10);
    const y = parseInt(dobYear, 10);

    if (isNaN(d) || d < 1 || d > 31 || isNaN(m) || m < 1 || m > 12 || isNaN(y) || y < 1920 || y > new Date().getFullYear()) {
      showError('Validation Error', 'Please select a valid Date of Birth.');
      return false;
    }

    const dob = new Date(y, m - 1, d);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    if (age < 18) {
      showError('Ineligible Age', 'You must be at least 18 years old to proceed.');
      return false;
    }

    return true;
  };

  const validateStep3 = () => {
    if (phoneNumber.trim().length < 6) {
      showError('Validation Error', 'Please enter a valid contact phone number.');
      return false;
    }
    if (!bloodGroup) {
      showError('Validation Error', 'Please select your blood group.');
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    if (!locationType) {
      showError('Validation Error', 'Please configure your location parameters to continue.');
      return false;
    }
    if (locationType === 'MANUAL' && (!division || !district || !upazila)) {
      showError('Validation Error', 'Please complete all manual location fields.');
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3) {
      if (!validateStep3()) return;
      
      setIsLoading(true);
      try {
        const formattedPhone = `${phonePrefix}${phoneNumber.trim()}`;
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || null;

        const { data: phoneExists, error: rpcError } = await supabase.rpc('check_phone_exists', {
          phone: formattedPhone,
          current_user_id: userId,
        });

        if (rpcError) {
          console.error('Error invoking check_phone_exists RPC:', rpcError);
        } else if (phoneExists) {
          showError('Duplicate Phone Number', 'This number is already registered. Please try another one.');
          setIsLoading(false);
          return;
        }

        setIsPhoneVerified(true);
      } catch (e) {
        console.error('Exception checking duplicate phone:', e);
      } finally {
        setIsLoading(false);
      }
    }
    if (step === 4 && !validateStep4()) return;

    if (step < 5) {
      LayoutAnimation.configureNext(smoothLayoutAnim);
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      LayoutAnimation.configureNext(smoothLayoutAnim);
      setStep((prev) => prev - 1);
    }
  };

  const handleCompleteSetup = async () => {
    setIsLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        showError('Session Timeout', 'Session not found. Please log in again.');
        return;
      }

      // Fetch device push notification token if user opted in
      let pushToken = null;
      try {
        if (isDonorOptedIn) {
          pushToken = await registerForPushNotificationsAsync();
        }
      } catch (tokenErr) {
        console.warn('Failed to fetch push token during onboarding:', tokenErr);
      }

      const formattedDob = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
      const formattedPhone = `${phonePrefix}${phoneNumber.trim()}`;

      // Update profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          date_of_birth: formattedDob,
          blood_group: bloodGroup,
          gender: gender,
          division: division || 'Dhaka',
          district: district || 'Dhaka',
          upazila: upazila || 'Dhaka City',
          phone_number: formattedPhone,
          location_coords: (latitude !== null && longitude !== null && !isNaN(latitude) && !isNaN(longitude)) 
            ? `POINT(${longitude} ${latitude})` 
            : null,
          push_token: pushToken,
        })
        .eq('id', user.id);

      if (profileError) {
        showError('Save Failed', profileError.message);
        setIsLoading(false);
        return;
      }

      // Update donor_statuses
      const { error: statusError } = await supabase
        .from('donor_statuses')
        .update({
          state: isDonorOptedIn ? 'ACTIVE' : 'NOT_A_DONOR',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (statusError) {
        showError('Save Failed', statusError.message);
        setIsLoading(false);
        return;
      }

      DeviceEventEmitter.emit('profileUpdated');
      router.replace('/onboarding/how-to-use');
    } catch (e) {
      showError('Save Failed', 'An unexpected error occurred. Please check your network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCountryCodes = COUNTRY_CODES.filter((item) =>
    item.country.toLowerCase().includes(searchCodeQuery.toLowerCase()) ||
    item.code.includes(searchCodeQuery)
  );

  const getIsNextDisabled = () => {
    if (step === 1) {
      return fullName.trim().length < 3 || !gender;
    }
    if (step === 2) {
      return !dobDay || !dobMonth || !dobYear;
    }
    if (step === 3) {
      return phoneNumber.trim().length < 6 || !bloodGroup;
    }
    if (step === 4) {
      return !locationType || (locationType === 'MANUAL' && (!division || !district || !upazila));
    }
    return false;
  };

  const isNextDisabled = getIsNextDisabled();
  const isOtpDisabled = phoneOtp.join('').length < 6;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.page }]} edges={['top', 'bottom']}>
      <StatusBar 
        barStyle={theme.dark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.bg.page} 
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContainer} 
          keyboardShouldPersistTaps="handled" 
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={{ flex: 1, justifyContent: 'space-between' }}>
            <View>
              {/* Step Indicator Header (Clean spacing and theme integration) */}
              <View style={styles.indicatorContainer}>
                <Text style={[styles.indicatorTitle, { 
                  fontFamily: theme.typography.h1.fontFamily,
                  color: theme.colors.text.primary 
                }]}>Setup Profile</Text>
                
                <Text style={[styles.indicatorSubtitle, { 
                  fontFamily: theme.typography.caption.fontFamily,
                  color: theme.colors.text.secondary 
                }]}>Step {step} of 5</Text>
                
                <View style={[styles.progressBar, { backgroundColor: theme.colors.border.subtle }]}>
                  <View style={[styles.progressActive, { 
                    width: `${(step / 5) * 100}%`,
                    backgroundColor: theme.colors.brand.default 
                  }]} />
                </View>
              </View>

              {/* Step 1: Name & Gender */}
              {step === 1 && (
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.stepBlock}>
                  <Text style={[styles.stepTitle, { 
                    fontFamily: theme.typography.h2.fontFamily,
                    color: theme.colors.text.primary 
                  }]}>Identify Yourself</Text>
                  <Text style={[styles.stepDesc, { 
                    fontFamily: theme.typography.body.fontFamily,
                    color: theme.colors.text.secondary 
                  }]}>What should Veno coordinators call you?</Text>

                  {/* Airbnb style Input box */}
                  <View style={[styles.inputBox, { 
                    backgroundColor: theme.colors.bg.surface,
                    borderColor: isNameFocused ? theme.colors.brand.default : theme.colors.border.subtle,
                    borderWidth: isNameFocused ? 2 : 1.5,
                    borderRadius: theme.radius.md,
                  }]}>
                    <User 
                      size={20} 
                      color={isNameFocused ? theme.colors.brand.default : theme.colors.text.secondary} 
                      style={styles.inputIcon} 
                    />
                    <TextInput
                      style={[styles.inputField, { 
                        fontFamily: theme.typography.body.fontFamily,
                        color: theme.colors.text.primary 
                      }]}
                      placeholder="Full Name (Legal NID Name)"
                      placeholderTextColor={theme.colors.text.tertiary}
                      value={fullName}
                      onChangeText={setFullName}
                      editable={!isLoading}
                      onFocus={() => {
                        LayoutAnimation.configureNext(smoothLayoutAnim);
                        setIsNameFocused(true);
                      }}
                      onBlur={() => {
                        LayoutAnimation.configureNext(smoothLayoutAnim);
                        setIsNameFocused(false);
                      }}
                    />
                    {fullName.trim().length >= 3 && (
                      <CheckCircle size={20} color={theme.colors.status.active} weight="fill" />
                    )}
                  </View>

                  <Text style={[styles.fieldLabel, { 
                    fontFamily: theme.typography.caption.fontFamily,
                    color: theme.colors.text.secondary 
                  }]}>GENDER</Text>
                  
                  {/* Dropdown select box for Gender */}
                  <TouchableOpacity
                    style={[styles.dropdownSelect, {
                      backgroundColor: theme.colors.bg.surface,
                      borderColor: theme.colors.border.subtle,
                      borderRadius: theme.radius.md,
                    }]}
                    onPress={() => setActivePicker('gender')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dropdownSelectText, {
                      color: gender ? theme.colors.text.primary : theme.colors.text.tertiary,
                      fontFamily: theme.typography.body.fontFamily
                    }]}>
                      {gender === 'MALE' ? '👨  Male' : gender === 'FEMALE' ? '👩  Female' : gender === 'OTHER' ? '👤  Other' : 'Select Gender'}
                    </Text>
                    <CaretDown size={16} color={theme.colors.text.secondary} />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Step 2: Date of Birth */}
              {step === 2 && (
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.stepBlock}>
                  <Text style={[styles.stepTitle, { 
                    fontFamily: theme.typography.h2.fontFamily,
                    color: theme.colors.text.primary 
                  }]}>Verify Legal Age</Text>
                  <Text style={[styles.stepDesc, { 
                    fontFamily: theme.typography.body.fontFamily,
                    color: theme.colors.text.secondary 
                  }]}>You must be at least 18 years old to join our active donor network.</Text>

                  <View style={styles.dobRow}>
                    <View style={styles.dobColumn}>
                      <Text style={[styles.dobLabel, { 
                        fontFamily: theme.typography.caption.fontFamily,
                        color: theme.colors.text.secondary 
                      }]}>Day</Text>
                      <TouchableOpacity
                        style={[styles.dropdownSelect, {
                          backgroundColor: theme.colors.bg.surface,
                          borderColor: theme.colors.border.subtle,
                          borderRadius: theme.radius.md,
                        }]}
                        onPress={() => setActivePicker('day')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.dropdownSelectText, {
                          color: dobDay ? theme.colors.text.primary : theme.colors.text.tertiary,
                          fontFamily: theme.typography.body.fontFamily
                        }]}>
                          {dobDay ? dobDay : 'DD'}
                        </Text>
                        <CaretDown size={14} color={theme.colors.text.secondary} />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={[styles.dobColumn, { flex: 1.5 }]}>
                      <Text style={[styles.dobLabel, { 
                        fontFamily: theme.typography.caption.fontFamily,
                        color: theme.colors.text.secondary 
                      }]}>Month</Text>
                      <TouchableOpacity
                        style={[styles.dropdownSelect, {
                          backgroundColor: theme.colors.bg.surface,
                          borderColor: theme.colors.border.subtle,
                          borderRadius: theme.radius.md,
                        }]}
                        onPress={() => setActivePicker('month')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.dropdownSelectText, {
                          color: dobMonth ? theme.colors.text.primary : theme.colors.text.tertiary,
                          fontFamily: theme.typography.body.fontFamily
                        }]} numberOfLines={1}>
                          {dobMonth ? MONTH_NAMES[parseInt(dobMonth, 10) - 1] : 'MM'}
                        </Text>
                        <CaretDown size={14} color={theme.colors.text.secondary} />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={[styles.dobColumn, { flex: 1.2 }]}>
                      <Text style={[styles.dobLabel, { 
                        fontFamily: theme.typography.caption.fontFamily,
                        color: theme.colors.text.secondary 
                      }]}>Year</Text>
                      <TouchableOpacity
                        style={[styles.dropdownSelect, {
                          backgroundColor: theme.colors.bg.surface,
                          borderColor: theme.colors.border.subtle,
                          borderRadius: theme.radius.md,
                        }]}
                        onPress={() => setActivePicker('year')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.dropdownSelectText, {
                          color: dobYear ? theme.colors.text.primary : theme.colors.text.tertiary,
                          fontFamily: theme.typography.body.fontFamily
                        }]}>
                          {dobYear ? dobYear : 'YYYY'}
                        </Text>
                        <CaretDown size={14} color={theme.colors.text.secondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Step 3: Phone Prefix & Blood Group */}
              {step === 3 && (
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.stepBlock}>
                  <Text style={[styles.stepTitle, { 
                    fontFamily: theme.typography.h2.fontFamily,
                    color: theme.colors.text.primary 
                  }]}>Contact & Blood Type</Text>
                  <Text style={[styles.stepDesc, { 
                    fontFamily: theme.typography.body.fontFamily,
                    color: theme.colors.text.secondary 
                  }]}>Provide your phone number and blood type compatibility.</Text>

                  <Text style={[styles.fieldLabel, { 
                    fontFamily: theme.typography.caption.fontFamily,
                    color: theme.colors.text.secondary 
                  }]}>PHONE NUMBER</Text>
                  
                  <View style={styles.phoneInputRow}>
                    <TouchableOpacity
                      style={[styles.prefixButton, { 
                        backgroundColor: theme.colors.bg.surface,
                        borderColor: theme.colors.border.subtle,
                        borderRadius: theme.radius.md,
                      }]}
                      onPress={() => setIsCodeModalVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.prefixText, { 
                        fontFamily: theme.typography.body.fontFamily,
                        color: theme.colors.text.primary 
                      }]}>{phoneFlag} {phonePrefix}</Text>
                      <CaretDown size={14} color={theme.colors.text.secondary} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.phoneInput, { 
                        fontFamily: theme.typography.body.fontFamily,
                        color: theme.colors.text.primary,
                        backgroundColor: theme.colors.bg.surface,
                        borderColor: theme.colors.border.subtle,
                        borderRadius: theme.radius.md,
                      }]}
                      placeholder="Mobile Number"
                      placeholderTextColor={theme.colors.text.tertiary}
                      keyboardType="phone-pad"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                    />
                  </View>

                  <Text style={[styles.fieldLabel, { 
                    fontFamily: theme.typography.caption.fontFamily,
                    color: theme.colors.text.secondary 
                  }]}>BLOOD GROUP</Text>
                  
                  {/* Clean 4x2 grid of buttons */}
                  <View style={styles.bloodGrid}>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => (
                      <TouchableOpacity
                        key={group}
                        style={[
                          styles.bloodCard,
                          bloodGroup === group ? {
                            backgroundColor: theme.colors.brand.default,
                            borderColor: theme.colors.brand.default,
                          } : {
                            backgroundColor: theme.colors.bg.surface,
                            borderColor: theme.colors.border.subtle,
                          },
                          { borderRadius: theme.radius.md }
                        ]}
                        onPress={() => setBloodGroup(group)}
                        activeOpacity={0.8}
                      >
                        <Drop 
                          size={16} 
                          color={bloodGroup === group ? '#FFF' : theme.colors.brand.default} 
                          weight="fill"
                          style={{ marginBottom: 4 }} 
                        />
                        <Text style={[
                          styles.bloodGroupText,
                          { 
                            fontFamily: theme.typography.blood.fontFamily,
                            color: bloodGroup === group ? '#FFF' : theme.colors.text.primary 
                          }
                        ]}>
                          {group}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Step 4: Geolocation Settings */}
              {step === 4 && (
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.stepBlock}>
                  <Text style={[styles.stepTitle, { 
                    fontFamily: theme.typography.h2.fontFamily,
                    color: theme.colors.text.primary 
                  }]}>Donor Location</Text>
                  <Text style={[styles.stepDesc, { 
                    fontFamily: theme.typography.body.fontFamily,
                    color: theme.colors.text.secondary 
                  }]}>We require your active area to coordinate nearby matching notifications.</Text>

                  <TouchableOpacity 
                    style={[
                      styles.optionCard,
                      locationType === 'GPS' ? {
                        borderColor: theme.colors.brand.default,
                        backgroundColor: theme.colors.brand.subtle,
                      } : {
                        borderColor: theme.colors.border.subtle,
                        backgroundColor: theme.colors.bg.surface,
                      },
                      { borderRadius: theme.radius.lg }
                    ]}
                    onPress={handleGPSRequest}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.optionIconBg, { 
                      backgroundColor: locationType === 'GPS' ? theme.colors.brand.default : theme.colors.brand.subtle 
                    }]}>
                      <NavigationArrow size={22} color={locationType === 'GPS' ? '#FFF' : theme.colors.brand.default} weight="fill" />
                    </View>
                    <View style={styles.optionCardText}>
                      <Text style={[styles.optionTitle, { 
                        fontFamily: theme.typography.h3.fontFamily,
                        color: theme.colors.text.primary 
                      }]}>Get Location Automatically</Text>
                      <Text style={[styles.optionDesc, { 
                        fontFamily: theme.typography.bodySm.fontFamily,
                        color: theme.colors.text.secondary 
                      }]}>Fetch exact GPS coordinates using mobile sensors.</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[
                      styles.optionCard,
                      locationType === 'MANUAL' ? {
                        borderColor: theme.colors.brand.default,
                        backgroundColor: theme.colors.brand.subtle,
                      } : {
                        borderColor: theme.colors.border.subtle,
                        backgroundColor: theme.colors.bg.surface,
                      },
                      { borderRadius: theme.radius.lg }
                    ]}
                    onPress={handleOpenMap}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.optionIconBg, { 
                      backgroundColor: locationType === 'MANUAL' ? theme.colors.brand.default : theme.colors.brand.subtle 
                    }]}>
                      <MapPin size={22} color={locationType === 'MANUAL' ? '#FFF' : theme.colors.brand.default} weight="fill" />
                    </View>
                    <View style={styles.optionCardText}>
                      <Text style={[styles.optionTitle, { 
                        fontFamily: theme.typography.h3.fontFamily,
                        color: theme.colors.text.primary 
                      }]}>Set Location Manually</Text>
                      <Text style={[styles.optionDesc, { 
                        fontFamily: theme.typography.bodySm.fontFamily,
                        color: theme.colors.text.secondary 
                      }]}>Open interactive map to choose your exact donation location.</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Selected Location Summary Card */}
                  {locationType && division && (
                    <View style={[styles.selectedLocationCard, { 
                      backgroundColor: theme.colors.bg.surface,
                      borderColor: theme.colors.brand.default,
                      borderWidth: 1.5,
                      borderRadius: theme.radius.md,
                    }]}>
                      <View style={[styles.selectedLocIconBg, { backgroundColor: theme.colors.brand.subtle }]}>
                        {locationType === 'GPS' ? (
                          <CrosshairSimple size={20} color={theme.colors.brand.default} weight="fill" />
                        ) : (
                          <MapPin size={20} color={theme.colors.brand.default} weight="fill" />
                        )}
                      </View>
                      <View style={styles.selectedLocText}>
                        <Text style={[styles.selectedLocTitle, { 
                          fontFamily: theme.typography.h3.fontFamily,
                          color: theme.colors.text.primary 
                        }]}>{upazila}</Text>
                        <Text style={[styles.selectedLocDesc, { 
                          fontFamily: theme.typography.bodySm.fontFamily,
                          color: theme.colors.text.secondary 
                        }]}>{district}, {division}</Text>
                        <Text style={[styles.selectedLocCoords, { 
                          fontFamily: theme.typography.caption.fontFamily,
                          color: theme.colors.brand.text 
                        }]}>{locationType === 'GPS' ? '📡 Detected via GPS' : '📍 Set manually'}</Text>
                      </View>
                      <TouchableOpacity 
                        style={[styles.changeLocBtn, { backgroundColor: theme.colors.bg.subtle, borderRadius: theme.radius.sm }]}
                        onPress={handleOpenMap}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.changeLocBtnText, { 
                          fontFamily: theme.typography.caption.fontFamily,
                          color: theme.colors.brand.text 
                        }]}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Animated.View>
              )}

              {/* Step 5: Donor Opt-In */}
              {step === 5 && (
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.stepBlock}>
                  <Text style={[styles.stepTitle, { 
                    fontFamily: theme.typography.h2.fontFamily,
                    color: theme.colors.text.primary 
                  }]}>Donor Program Opt-In</Text>
                  <Text style={[styles.stepDesc, { 
                    fontFamily: theme.typography.body.fontFamily,
                    color: theme.colors.text.secondary 
                  }]}>Become an active donor to save lives.</Text>

                  <View style={[styles.optInCard, { 
                    backgroundColor: theme.colors.brand.subtle,
                    borderColor: theme.colors.brand.default,
                    borderRadius: theme.radius.lg,
                  }]}>
                    <View style={styles.optInHeaderRow}>
                      <View style={[styles.optInIconBg, { backgroundColor: '#FFFFFF' }]}>
                        <Drop size={24} color={theme.colors.brand.default} weight="fill" />
                      </View>
                      <Text style={[styles.optInTitle, { 
                        fontFamily: theme.typography.h3.fontFamily,
                        color: theme.colors.brand.text 
                      }]}>Register as Active Donor</Text>
                    </View>
                    <Text style={[styles.optInDesc, { 
                      fontFamily: theme.typography.bodySm.fontFamily,
                      color: theme.colors.text.secondary 
                    }]}>
                      If checked, you consent to let Veno verify your compatibility and notify you during local blood requests. You can disable this preference anytime in settings.
                    </Text>
                    
                    <View style={styles.choiceRow}>
                      <TouchableOpacity 
                        style={[
                          styles.choiceBtn, 
                          isDonorOptedIn ? {
                            backgroundColor: theme.colors.brand.default,
                            borderColor: theme.colors.brand.default,
                          } : {
                            backgroundColor: '#FFFFFF',
                            borderColor: theme.colors.border.default,
                          },
                          { borderRadius: theme.radius.md }
                        ]}
                        onPress={() => setIsDonorOptedIn(true)}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          styles.choiceText, 
                          { 
                            fontFamily: theme.typography.body.fontFamily,
                            color: isDonorOptedIn ? '#FFF' : theme.colors.text.secondary 
                          }
                        ]}>Active Opt-In</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[
                          styles.choiceBtn, 
                          !isDonorOptedIn ? {
                            backgroundColor: theme.colors.brand.default,
                            borderColor: theme.colors.brand.default,
                          } : {
                            backgroundColor: '#FFFFFF',
                            borderColor: theme.colors.border.default,
                          },
                          { borderRadius: theme.radius.md }
                        ]}
                        onPress={() => setIsDonorOptedIn(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          styles.choiceText, 
                          { 
                            fontFamily: theme.typography.body.fontFamily,
                            color: !isDonorOptedIn ? '#FFF' : theme.colors.text.secondary 
                          }
                        ]}>Skip/Pause</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              )}
            </View>

            {/* Navigation Action Buttons (Section 6.1 rounded to radius-md 10px) */}
            <View style={styles.buttonRow}>
              {step > 1 && (
                <TouchableOpacity 
                  style={[styles.backButton, { 
                    borderColor: theme.colors.border.default,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.bg.surface,
                  }]} 
                  onPress={handleBack} 
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <ArrowLeft size={20} color={theme.colors.text.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.backButtonText, { 
                    fontFamily: theme.typography.bodyLg.fontFamily,
                    color: theme.colors.text.primary 
                  }]}>Back</Text>
                </TouchableOpacity>
              )}

              {step < 5 ? (
                <TouchableOpacity 
                  style={[
                    styles.nextButton, 
                    step === 1 && { width: '100%' },
                    { 
                      backgroundColor: isNextDisabled ? theme.colors.border.subtle : theme.colors.brand.default,
                      borderRadius: theme.radius.md,
                    }
                  ]} 
                  onPress={handleNext}
                  disabled={isLoading || isNextDisabled}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.nextButtonText, { 
                    fontFamily: theme.typography.bodyLg.fontFamily,
                    color: isNextDisabled ? theme.colors.text.tertiary : theme.colors.text.onColor 
                  }]}>Next Step</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.nextButton, { 
                    backgroundColor: theme.colors.brand.default,
                    borderRadius: theme.radius.md,
                  }]} 
                  onPress={handleCompleteSetup}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <CustomLoader size="small" color={theme.colors.text.onColor} />
                  ) : (
                    <Text style={[styles.nextButtonText, { 
                      fontFamily: theme.typography.bodyLg.fontFamily,
                      color: theme.colors.text.onColor 
                    }]}>Complete Setup</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Country Code Prefix Modal */}
          <Modal
            visible={isCodeModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsCodeModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { 
                backgroundColor: theme.colors.bg.surfaceRaised,
                borderTopLeftRadius: theme.radius.lg,
                borderTopRightRadius: theme.radius.lg,
              }]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalHeader, { 
                    fontFamily: theme.typography.h2.fontFamily,
                    color: theme.colors.text.primary 
                  }]}>Select Country Code</Text>
                  <TouchableOpacity onPress={() => setIsCodeModalVisible(false)}>
                    <Text style={[styles.closeText, { 
                      fontFamily: theme.typography.h3.fontFamily,
                      color: theme.colors.brand.default 
                    }]}>Close</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.searchBar, { 
                  backgroundColor: theme.colors.bg.subtle,
                  borderColor: theme.colors.border.subtle,
                  borderRadius: theme.radius.md,
                }]}>
                  <MagnifyingGlass size={18} color={theme.colors.text.tertiary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.searchInput, { 
                      fontFamily: theme.typography.body.fontFamily,
                      color: theme.colors.text.primary 
                    }]}
                    placeholder="Search country or code..."
                    placeholderTextColor={theme.colors.text.tertiary}
                    value={searchCodeQuery}
                    onChangeText={setSearchCodeQuery}
                  />
                </View>

                <FlatList
                  data={filteredCountryCodes}
                  keyExtractor={(item) => item.code}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.codeItem, { borderBottomColor: theme.colors.border.subtle }]}
                      onPress={() => {
                        setPhonePrefix(item.code);
                        setPhoneFlag(item.flag);
                        setIsCodeModalVisible(false);
                        setSearchCodeQuery('');
                      }}
                    >
                      <Text style={styles.codeFlag}>{item.flag}</Text>
                      <Text style={[styles.codeCountry, { 
                        fontFamily: theme.typography.body.fontFamily,
                        color: theme.colors.text.primary 
                      }]}>{item.country}</Text>
                      <Text style={[styles.codePrefix, { 
                        fontFamily: theme.typography.h3.fontFamily,
                        color: theme.colors.text.secondary 
                      }]}>{item.code}</Text>
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </View>
          </Modal>

          {/* Phone OTP Verification Modal */}
          <Modal
            visible={isPhoneModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsPhoneModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { 
                backgroundColor: theme.colors.bg.surfaceRaised,
                borderTopLeftRadius: theme.radius.lg,
                borderTopRightRadius: theme.radius.lg,
                maxHeight: '80%' 
              }]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalHeader, { 
                    fontFamily: theme.typography.h2.fontFamily,
                    color: theme.colors.text.primary 
                  }]}>Verify Mobile Number</Text>
                  <TouchableOpacity onPress={() => setIsPhoneModalVisible(false)} disabled={isLoading}>
                    <Text style={[styles.closeText, { 
                      fontFamily: theme.typography.h3.fontFamily,
                      color: theme.colors.brand.default 
                    }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalSubtext, { 
                  fontFamily: theme.typography.body.fontFamily,
                  color: theme.colors.text.secondary 
                }]}>
                  Enter the 6-digit verification code sent to {phonePrefix} {phoneNumber}.
                </Text>

                <View style={styles.otpRow}>
                  {phoneOtp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => { phoneInputRefs.current[index] = ref; }}
                      style={[
                        styles.otpInput, 
                        {
                          fontFamily: theme.typography.h2.fontFamily,
                          color: theme.colors.text.primary,
                          backgroundColor: theme.colors.bg.surface,
                          borderColor: theme.colors.border.subtle,
                          borderRadius: theme.radius.md,
                        },
                        digit ? {
                          borderColor: theme.colors.brand.default,
                          backgroundColor: theme.colors.brand.subtle,
                        } : null
                      ]}
                      value={digit}
                      onChangeText={(val) => {
                        const newOtp = [...phoneOtp];
                        newOtp[index] = val;
                        setPhoneOtp(newOtp);
                        if (val && index < 5) {
                          phoneInputRefs.current[index + 1]?.focus();
                        }
                      }}
                      onKeyPress={({ nativeEvent }) => {
                        if (nativeEvent.key === 'Backspace' && !phoneOtp[index] && index > 0) {
                          phoneInputRefs.current[index - 1]?.focus();
                        }
                      }}
                  keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                      editable={!isLoading}
                      textAlign="center"
                    />
                  ))}
                </View>

                <TouchableOpacity 
                  style={[styles.nextButton, { 
                    backgroundColor: isOtpDisabled ? theme.colors.border.subtle : theme.colors.brand.default,
                    borderRadius: theme.radius.md,
                    width: '100%',
                  }]} 
                  onPress={handleVerifyPhoneOTP}
                  disabled={isLoading || isOtpDisabled}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <CustomLoader size="small" color={theme.colors.text.onColor} />
                  ) : (
                    <Text style={[styles.nextButtonText, { 
                      fontFamily: theme.typography.bodyLg.fontFamily,
                      color: isOtpDisabled ? theme.colors.text.tertiary : theme.colors.text.onColor 
                    }]}>Verify & Proceed</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.resendContainer}>
                  <Text style={[styles.resendLabel, { 
                    fontFamily: theme.typography.bodySm.fontFamily,
                    color: theme.colors.text.secondary 
                  }]}>Didn't receive code? </Text>
                  <TouchableOpacity 
                    onPress={handleSendPhoneOTP} 
                    disabled={phoneTimer > 0 || isLoading}
                  >
                    <Text style={[
                      styles.resendLink, 
                      { fontFamily: theme.typography.bodySm.fontFamily, color: theme.colors.brand.default },
                      phoneTimer > 0 && { color: theme.colors.text.tertiary }
                    ]}>
                      {phoneTimer > 0 ? `Resend in ${phoneTimer}s` : 'Resend Code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dynamic Date & Gender Picker Modal */}
      <Modal
        visible={activePicker !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActivePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { 
            backgroundColor: theme.colors.bg.surfaceRaised,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            maxHeight: '45%' 
          }]}>
            <View style={styles.bottomSheetHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeader, { 
                fontFamily: theme.typography.h2.fontFamily,
                color: theme.colors.text.primary 
              }]}>
                {activePicker === 'day' 
                  ? 'Select Birth Day' 
                  : activePicker === 'month' 
                  ? 'Select Birth Month' 
                  : activePicker === 'year' 
                  ? 'Select Birth Year' 
                  : 'Select Gender'}
              </Text>
              <TouchableOpacity onPress={() => setActivePicker(null)}>
                <Text style={[styles.closeText, { 
                  fontFamily: theme.typography.h3.fontFamily,
                  color: theme.colors.brand.default 
                }]}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={
                (activePicker === 'day'
                  ? Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
                  : activePicker === 'month'
                  ? MONTH_NAMES.map((m, idx) => ({ label: m, value: String(idx + 1).padStart(2, '0') }))
                  : activePicker === 'year'
                  ? Array.from({ length: 80 }, (_, i) => String(new Date().getFullYear() - 18 - i))
                  : [
                      { label: '👨  Male', value: 'MALE' },
                      { label: '👩  Female', value: 'FEMALE' },
                      { label: '👤  Other', value: 'OTHER' }
                    ]) as any[]
              }
              keyExtractor={(item: any) => (typeof item === 'string' ? item : item.value)}
              renderItem={({ item }: { item: any }) => {
                const label = typeof item === 'string' ? item : item.label;
                const value = typeof item === 'string' ? item : item.value;
                const isSelected = 
                  activePicker === 'day' ? dobDay === value :
                  activePicker === 'month' ? dobMonth === value :
                  activePicker === 'year' ? dobYear === value :
                  gender === value;

                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerItem, 
                      { borderBottomColor: theme.colors.border.subtle },
                      isSelected && { backgroundColor: theme.colors.brand.subtle }
                    ]}
                    onPress={() => {
                      LayoutAnimation.configureNext(smoothLayoutAnim);
                      if (activePicker === 'day') {
                        setDobDay(value);
                      } else if (activePicker === 'month') {
                        setDobMonth(value);
                      } else if (activePicker === 'year') {
                        setDobYear(value);
                      } else if (activePicker === 'gender') {
                        setGender(value as any);
                      }
                      setActivePicker(null);
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText, 
                      { 
                        fontFamily: theme.typography.body.fontFamily,
                        color: isSelected ? theme.colors.brand.text : theme.colors.text.primary 
                      }
                    ]}>
                      {label}
                    </Text>
                    {isSelected && (
                      <CheckCircle size={18} color={theme.colors.brand.default} weight="fill" />
                    )}
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* Custom Error Notification Modal */}
      <Modal
        visible={errorVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          LayoutAnimation.configureNext(smoothLayoutAnim);
          setErrorVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { 
            backgroundColor: theme.colors.bg.surfaceRaised,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            paddingBottom: Platform.OS === 'ios' ? 40 : 24,
            alignItems: 'center',
          }]}>
            <View style={styles.bottomSheetHandle} />
            <View style={[styles.errorIconBg, { backgroundColor: theme.colors.status.criticalBg }]}>
              <ShieldWarning size={32} color={theme.colors.status.criticalText} weight="fill" />
            </View>
            <Text style={[styles.errorModalTitle, { 
              fontFamily: theme.typography.h2.fontFamily,
              color: theme.colors.text.primary 
            }]}>{errorTitle}</Text>
            <Text style={[styles.errorModalText, { 
              fontFamily: theme.typography.body.fontFamily,
              color: theme.colors.text.secondary 
            }]}>{errorMessage}</Text>
            
            <TouchableOpacity 
              style={[styles.errorCloseBtn, { 
                backgroundColor: theme.colors.brand.default,
                borderRadius: theme.radius.md 
              }]}
              onPress={() => {
                LayoutAnimation.configureNext(smoothLayoutAnim);
                setErrorVisible(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.errorCloseText, { 
                fontFamily: theme.typography.bodyLg.fontFamily,
                color: theme.colors.text.onColor 
              }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Map Manual Location Picker Modal */}
      <Modal 
        visible={isMapVisible} 
        animationType="slide" 
        onRequestClose={() => {
          handleClearSearch();
          setIsMapVisible(false);
        }}
      >
        <SafeAreaView style={[styles.mapModalContainer, { backgroundColor: theme.colors.bg.page }]} edges={['top', 'bottom']}>
          {!mapEnabled ? (
            <StaticMapFallback onClose={() => setIsMapVisible(false)} />
          ) : (
            <>
              {/* Map View */}
              <View style={styles.mapWrapper}>
                <Mapbox.MapView
                  style={StyleSheet.absoluteFill}
                  onCameraChanged={handleMapCameraChange}
                  logoEnabled={false}
                  attributionEnabled={false}
                >
                  <Mapbox.Camera
                    ref={mapCameraRef}
                    zoomLevel={15}
                    centerCoordinate={[mapRegion.longitude, mapRegion.latitude]}
                    animationDuration={0}
                  />
                </Mapbox.MapView>

                {/* Static Centered Marker */}
                <View style={styles.centerMarkerContainer} pointerEvents="none">
                  <View style={[styles.markerCircle, { backgroundColor: theme.colors.bg.surface }]}>
                    <MapPin size={32} color={theme.colors.brand.default} weight="fill" />
                  </View>
                  <View style={[styles.markerDot, { backgroundColor: theme.colors.brand.default }]} />
                </View>

                {/* Back Button */}
                <TouchableOpacity 
                  style={[styles.mapCloseBtn, { backgroundColor: theme.colors.bg.surface }]}
                  onPress={() => {
                    handleClearSearch();
                    setIsMapVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <ArrowLeft size={20} color={theme.colors.text.primary} />
                </TouchableOpacity>

                {/* Google Maps-style Search Bar */}
                <View style={styles.mapSearchContainer}>
                  <View style={[styles.mapSearchBar, { 
                    backgroundColor: theme.colors.bg.surface,
                    borderRadius: theme.radius.md,
                    borderColor: isSearchFocused ? theme.colors.brand.default : 'transparent',
                    borderWidth: isSearchFocused ? 2 : 0,
                  }]}>
                    <MagnifyingGlass size={18} color={theme.colors.text.tertiary} style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.mapSearchInput, { 
                        fontFamily: theme.typography.body.fontFamily,
                        color: theme.colors.text.primary 
                      }]}
                      placeholder="Search location..."
                      placeholderTextColor={theme.colors.text.tertiary}
                      value={searchQuery}
                      onChangeText={handleSearchInput}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => {
                        // Small delay so tap on result registers
                        setTimeout(() => setIsSearchFocused(false), 200);
                      }}
                      returnKeyType="search"
                      autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={18} color={theme.colors.text.secondary} />
                      </TouchableOpacity>
                    )}
                    {isSearching && (
                      <CustomLoader size="small" color={theme.colors.brand.default} />
                    )}
                  </View>

                  {/* Search Results Dropdown */}
                  {searchResults.length > 0 && (
                    <View style={[styles.searchResultsDropdown, { 
                      backgroundColor: theme.colors.bg.surface,
                      borderRadius: theme.radius.md,
                    }]}>
                      <ScrollView 
                        keyboardShouldPersistTaps="handled" 
                        showsVerticalScrollIndicator={false}
                        style={{ maxHeight: 260 }}
                      >
                        {searchResults.map((item: any, index: number) => (
                          <TouchableOpacity
                            key={item.mapbox_id || index}
                            style={[
                              styles.searchResultItem, 
                              index < searchResults.length - 1 && { borderBottomColor: theme.colors.border.subtle, borderBottomWidth: 1 }
                            ]}
                            onPress={() => handleSelectSearchResult(item)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.searchResultIconBg, { backgroundColor: theme.colors.brand.subtle }]}>
                              <MapPin size={16} color={theme.colors.brand.default} weight="fill" />
                            </View>
                            <View style={styles.searchResultTextContainer}>
                              <Text 
                                style={[styles.searchResultName, { 
                                  fontFamily: theme.typography.body.fontFamily,
                                  color: theme.colors.text.primary 
                                }]} 
                                numberOfLines={1}
                              >
                                {item.name}
                              </Text>
                              {item.full_address && (
                                <Text 
                                  style={[styles.searchResultAddress, { 
                                    fontFamily: theme.typography.caption.fontFamily,
                                    color: theme.colors.text.secondary 
                                  }]} 
                                  numberOfLines={1}
                                >
                                  {item.full_address}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {/* Bottom Confirm Card */}
              <View style={[styles.mapBottomCard, { 
                backgroundColor: theme.colors.bg.surface,
                borderTopColor: theme.colors.border.subtle,
                borderTopWidth: 1,
              }]}>
                <Text style={[styles.mapCardTitle, { 
                  fontFamily: theme.typography.h3.fontFamily,
                  color: theme.colors.text.primary 
                }]}>Set Your Location</Text>
                <Text style={[styles.mapCardSubtitle, { 
                  fontFamily: theme.typography.bodySm.fontFamily,
                  color: theme.colors.text.secondary 
                }]}>Search for a place or drag the map to position the pin over your area.</Text>

                <View style={[styles.addressBox, { 
                  backgroundColor: theme.colors.bg.subtle,
                  borderRadius: theme.radius.md 
                }]}>
                  {resolvedAddress ? (
                    <View style={styles.addressContent}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <MapPin size={16} color={theme.colors.brand.default} weight="fill" />
                        <Text style={[styles.addressText, { 
                          fontFamily: theme.typography.body.fontFamily,
                          color: theme.colors.text.primary 
                        }]}>
                          {resolvedAddress.formatted}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.addressContent}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <MapPin size={16} color={theme.colors.brand.default} weight="fill" />
                        <Text style={[styles.addressText, { 
                          fontFamily: theme.typography.body.fontFamily,
                          color: theme.colors.text.secondary 
                        }]}>
                          Align the pin precisely over your location.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity 
                  style={[
                    styles.mapConfirmBtn, 
                    { borderRadius: theme.radius.md },
                    isResolvingAddress ? {
                      backgroundColor: theme.colors.border.strong,
                      opacity: 0.5,
                    } : {
                      backgroundColor: theme.colors.brand.default,
                    }
                  ]} 
                  onPress={handleConfirmMapLocation}
                  disabled={isResolvingAddress}
                  activeOpacity={0.8}
                >
                  {isResolvingAddress ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color={theme.colors.text.onColor} />
                      <Text style={[styles.mapConfirmBtnText, { 
                        fontFamily: theme.typography.bodyLg.fontFamily,
                        color: theme.colors.text.onColor 
                      }]}>RESOLVING LOCATION...</Text>
                    </View>
                  ) : (
                    <Text style={[styles.mapConfirmBtnText, { 
                      fontFamily: theme.typography.bodyLg.fontFamily,
                      color: theme.colors.text.onColor 
                    }]}>Confirm Location</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {isLoading && (
        <CustomLoader 
          overlay 
          message={
            step === 4
              ? 'Requesting location coordinates...'
              : step === 3 && isPhoneModalVisible
              ? 'Verifying OTP code...'
              : step === 3
              ? 'Sending verification OTP...'
              : 'Saving profile parameters...'
          } 
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
  },
  indicatorContainer: {
    marginBottom: 20,
  },
  indicatorTitle: {
    fontSize: 24,
    letterSpacing: -0.5,
  },
  indicatorSubtitle: {
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressActive: {
    height: '100%',
    borderRadius: 2,
  },
  stepBlock: {
    paddingVertical: 16,
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 20,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  stepDesc: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 24,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  fieldLabel: {
    fontSize: 12,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  subLabel: {
    fontSize: 12,
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  genderContainer: {
    flexDirection: 'column',
    gap: 10,
  },
  genderCard: {
    width: '100%',
    height: 52,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  genderText: {
    fontSize: 15,
  },
  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dobColumn: {
    flex: 1,
  },
  dobLabel: {
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  dobInput: {
    height: 52,
    borderWidth: 1.5,
    fontSize: 16,
  },
  dobDivider: {
    fontSize: 20,
    marginTop: 22,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  prefixButton: {
    width: 100,
    height: 52,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  prefixText: {
    fontSize: 14,
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodCard: {
    width: '23%',
    aspectRatio: 1.2,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloodGroupText: {
    fontSize: 15,
  },
  optionCard: {
    flexDirection: 'row',
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16,
    alignItems: 'center',
    gap: 16,
  },
  optionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionCardText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  manualSelectionBlock: {
    marginTop: 12,
  },
  pillScroll: {
    marginVertical: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    marginRight: 8,
    marginBottom: 8,
  },
  pillText: {
    fontSize: 13,
  },
  optInCard: {
    padding: 20,
    borderWidth: 1.5,
  },
  optInHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  optInIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optInTitle: {
    fontSize: 16,
  },
  optInDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  choiceBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceText: {
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
  },
  nextButton: {
    flex: 2,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    padding: 20,
    maxHeight: '75%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    fontSize: 18,
  },
  closeText: {
    fontSize: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  codeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  codeFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  codeCountry: {
    flex: 1,
    fontSize: 15,
  },
  codePrefix: {
    fontSize: 15,
  },
  modalSubtext: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  otpInput: {
    width: 42,
    height: 50,
    borderWidth: 1.5,
    fontSize: 18,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  resendLabel: {
    fontSize: 13,
  },
  resendLink: {
    fontSize: 13,
  },
  bottomSheetHandle: {
    width: 38,
    height: 4,
    backgroundColor: 'rgba(150, 150, 150, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  dropdownSelect: {
    height: 52,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dropdownSelectText: {
    fontSize: 15,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  pickerItemText: {
    fontSize: 16,
  },
  errorIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorModalTitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorModalText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  errorCloseBtn: {
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorCloseText: {
    fontSize: 16,
  },
  mapModalContainer: {
    flex: 1,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  centerMarkerContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -24,
    marginTop: -48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  markerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  mapCloseBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 11,
  },
  mapBottomCard: {
    padding: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  mapCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  mapCardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  addressBox: {
    padding: 16,
    minHeight: 76,
    justifyContent: 'center',
    marginBottom: 20,
  },
  addressLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addressLoadingText: {
    fontSize: 14,
  },
  addressContent: {
    justifyContent: 'center',
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    flex: 1,
  },
  addressErrorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  mapConfirmBtn: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapConfirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectedLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginTop: 16,
  },
  selectedLocIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  selectedLocText: {
    flex: 1,
  },
  selectedLocTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  selectedLocDesc: {
    fontSize: 13,
    marginBottom: 2,
  },
  selectedLocCoords: {
    fontSize: 11,
  },
  changeLocBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeLocBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mapSearchContainer: {
    position: 'absolute',
    top: 16,
    left: 68,
    right: 16,
    zIndex: 12,
  },
  mapSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    paddingVertical: 0,
  },
  searchResultsDropdown: {
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  searchResultIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultTextContainer: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchResultAddress: {
    fontSize: 12,
    marginTop: 2,
  },
});
