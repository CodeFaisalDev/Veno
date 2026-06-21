import React, { useEffect, useState } from 'react';
import { View, StyleSheet, DeviceEventEmitter } from 'react-native';
import { Stack, useRouter, useSegments, Redirect } from 'expo-router';
import { supabase } from '../utils/supabase';
import '../utils/tracking';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { ThemeProvider, useTheme } from '../theme';
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import CustomLoader from '../components/CustomLoader';

GoogleSignin.configure({
  webClientId: '229379410387-tsf4mvo3dbvtnri9heo7p0aq4fqbi5iv.apps.googleusercontent.com',
  offlineAccess: true,
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMMono_500Medium,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const [hasSeenIntro, setHasSeenIntro] = useState<boolean | null>(null);
  const [hasSeenGuide, setHasSeenGuide] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  const validateSessionAndGetProfile = async (currentSession: Session | null) => {
    if (!currentSession) {
      setSession(null);
      setIsProfileComplete(false);
      await AsyncStorage.setItem('is_profile_complete', 'false');
      return;
    }

    const userId = currentSession.user.id;
    setSession(currentSession);

    try {
      // Query profile data
      const { data, error, status } = await supabase
        .from('profiles')
        .select('full_name, date_of_birth, division, phone_number')
        .eq('id', userId)
        .single();

      if (error || !data) {
        // If session is invalid (e.g. unauthorized), sign out
        if (status === 401 || status === 403) {
          await supabase.auth.signOut();
          setSession(null);
          setIsProfileComplete(false);
          await AsyncStorage.setItem('is_profile_complete', 'false');
        } else {
          setIsProfileComplete(false);
          await AsyncStorage.setItem('is_profile_complete', 'false');
        }
      } else {
        const isDefaultName = data.full_name === 'New Donor';
        const isDefaultDob = data.date_of_birth === '2000-01-01';
        const isDefaultDivision = data.division === 'Default Division';
        const isPhoneMissing = !data.phone_number;

        const complete = !isDefaultName && !isDefaultDob && !isDefaultDivision && !isPhoneMissing;
        setIsProfileComplete(complete);
        await AsyncStorage.setItem('is_profile_complete', complete ? 'true' : 'false');
      }
    } catch (e) {
      // Offline fallback: keep initially loaded cache value if it was set, otherwise default to false
      if (isProfileComplete === null) {
        setIsProfileComplete(false);
      }
    }
  };

  useEffect(() => {
    let active = true;

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      validateSessionAndGetProfile(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        try {
          await AsyncStorage.removeItem('has_seen_intro');
          await AsyncStorage.removeItem('has_seen_guide');
          // Clear native Google Sign-In cached session
          await GoogleSignin.signOut();
        } catch (e) {
          console.error('Google Sign-Out Error:', e);
        }
        setSession(null);
        setIsProfileComplete(false);
      } else {
        await validateSessionAndGetProfile(session);
      }
    });

    // Listen for manual profile completeness updates to avoid slow checks on redirect
    const profileSub = DeviceEventEmitter.addListener('profileUpdated', async () => {
      if (active) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        await validateSessionAndGetProfile(currentSession);
      }
    });

    const guideSub = DeviceEventEmitter.addListener('guideUpdated', () => {
      if (active) {
        setHasSeenGuide(true);
      }
    });

    // Check AsyncStorage seen flags
    checkStorage();

    return () => {
      active = false;
      subscription.unsubscribe();
      profileSub.remove();
      guideSub.remove();
    };
  }, []);

  const checkStorage = async () => {
    try {
      const intro = await AsyncStorage.getItem('has_seen_intro');
      const guide = await AsyncStorage.getItem('has_seen_guide');
      const profileComplete = await AsyncStorage.getItem('is_profile_complete');
      
      setHasSeenIntro(intro === 'true');
      setHasSeenGuide(guide === 'true');
      if (profileComplete !== null) {
        setIsProfileComplete(profileComplete === 'true');
      }
    } catch (e) {
      console.error(e);
      setHasSeenIntro(false);
      setHasSeenGuide(false);
      setIsProfileComplete(false);
    }
  };

  useEffect(() => {
    if (isProfileComplete !== null && hasSeenIntro !== null && hasSeenGuide !== null && fontsLoaded) {
      setIsLoading(false);
    }
  }, [isProfileComplete, hasSeenIntro, hasSeenGuide, fontsLoaded]);

  if (isLoading || !fontsLoaded) {
    return (
      <ThemeProvider>
        <RootBootLoader />
      </ThemeProvider>
    );
  }

  const segmentsList = segments as any;
  const rootSegment = segmentsList[0];
  const subSegment = segmentsList[1];

  // Synchronous route protection/redirections to prevent dashboard flash!
  if (!session) {
    const isAllowedAuthScreen = 
      (rootSegment === 'onboarding' && subSegment === 'intro') ||
      (rootSegment === 'auth' && (subSegment === 'login' || subSegment === 'signup' || subSegment === 'otp'));
    
    if (!isAllowedAuthScreen) {
      return (
        <ThemeProvider>
          <Redirect href="/onboarding/intro" />
        </ThemeProvider>
      );
    }
  } else {
    const isResettingPassword = rootSegment === 'auth' && subSegment === 'reset-password';
    if (!isResettingPassword) {
      if (!isProfileComplete) {
        if (rootSegment !== 'onboarding' || subSegment !== 'profile-setup') {
          return (
            <ThemeProvider>
              <Redirect href="/onboarding/profile-setup" />
            </ThemeProvider>
          );
        }
      } else if (!hasSeenGuide) {
        if (rootSegment !== 'onboarding' || subSegment !== 'how-to-use') {
          return (
            <ThemeProvider>
              <Redirect href="/onboarding/how-to-use" />
            </ThemeProvider>
          );
        }
      } else {
        if (rootSegment === 'auth' || rootSegment === 'onboarding' || segmentsList.length === 0) {
          return (
            <ThemeProvider>
              <Redirect href="/(tabs)" />
            </ThemeProvider>
          );
        }
      }
    }
  }

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding/intro" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/login" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/signup" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/otp" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/register" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="auth/reset-password" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="onboarding/profile-setup" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="onboarding/how-to-use" options={{ animation: 'fade' }} />
        <Stack.Screen name="verify/nid-upload" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="profile/medical" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="request/create" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="tracking/[requestId]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      </Stack>
    </ThemeProvider>
  );
}

function RootBootLoader() {
  const theme = useTheme();
  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.colors.bg.page }]}>
      <CustomLoader message="Booting Veno..." />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
