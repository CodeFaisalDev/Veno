import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Modal,
  KeyboardAvoidingView,
  DeviceEventEmitter,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { 
  Envelope, 
  Lock, 
  ArrowLeft, 
  Eye, 
  EyeClosed, 
  Drop,
  ShieldWarning
} from 'phosphor-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental && !(globalThis as any).nativeFabricUIManager) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useTheme } from '../../theme';
import CustomLoader from '../../components/CustomLoader';

// GoogleSignin.configure() is handled in _layout.tsx (root)

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [errorVisible, setErrorVisible] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const showError = (title: string, message: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setErrorTitle(title);
    setErrorMessage(message);
    setErrorVisible(true);
  };

  const handlePostAuthNavigation = async (user: any) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, date_of_birth, division, phone_number')
        .eq('id', user.id)
        .single();

      const isDefaultName = !profile?.full_name || profile.full_name === 'New Donor';
      const isDefaultDob = !profile?.date_of_birth || profile.date_of_birth === '2000-01-01';
      const isDefaultDivision = !profile?.division || profile.division === 'Default Division';
      const isPhoneMissing = !profile?.phone_number;

      const isComplete = Boolean(profile && !isDefaultName && !isDefaultDob && !isDefaultDivision && !isPhoneMissing);

      await AsyncStorage.setItem('is_profile_complete', isComplete ? 'true' : 'false');
      if (isComplete) {
        await AsyncStorage.setItem('has_seen_guide', 'true');
      }
      DeviceEventEmitter.emit('profileUpdated');

      if (isComplete) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding/profile-setup');
      }
    } catch (e) {
      console.error('[Login] Error in post-auth navigation:', e);
      router.replace('/(tabs)');
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showError('Validation Error', 'Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    let authSucceeded = false;
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      if (cleanEmail.endsWith('@veno.test')) {
        // Developer bypass domain: try signing in with entered password
        let { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        // If credentials failed, try developer standard password
        if (error) {
          const fallbackRes = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: 'VenoSecureTempPassword123!',
          });
          if (!fallbackRes.error && fallbackRes.data?.user) {
            data = fallbackRes.data;
            error = null;
          }
        }

        // If user does not exist in Supabase yet, automatically create the test account!
        if (error && (
          error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('not found') ||
          error.message.toLowerCase().includes('invalid_grant')
        )) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: {
              data: {
                full_name: 'Test Donor',
                phone_number: '+8801700000000',
              }
            }
          });

          if (!signUpError && signUpData?.user) {
            const autoSignIn = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: cleanPassword,
            });

            if (!autoSignIn.error && autoSignIn.data?.user) {
              authSucceeded = true;
              await handlePostAuthNavigation(autoSignIn.data.user);
              return;
            } else if (signUpData?.user) {
              authSucceeded = true;
              await handlePostAuthNavigation(signUpData.user);
              return;
            }
          }
        }

        if (error) {
          showError('Login Failed', error.message);
          return;
        }

        if (data?.user) {
          authSucceeded = true;
          await handlePostAuthNavigation(data.user);
          return;
        }
      }

      // Standard production login for real emails
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        showError('Login Failed', error.message);
        return;
      }

      if (data?.user) {
        authSucceeded = true;
        await handlePostAuthNavigation(data.user);
      }
    } catch (err: any) {
      showError('Error', err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showError('Email Required', 'Please enter your email address first, then tap Forgot Password.');
      return;
    }

    setIsLoading(true);
    try {
      if (email.trim().endsWith('@veno.test')) {
        Alert.alert('Developer Mode', 'Password reset link/OTP skipped for test domain. Use any password to sign in.');
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('auth/otp'),
      });

      if (error) {
        showError('Reset Failed', error.message);
        return;
      }

      Alert.alert(
        'Code Sent', 
        'A 6-digit password reset verification code has been sent to your email. Please enter it on the next screen.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.push({
                pathname: '/auth/otp',
                params: { email: email.trim(), type: 'recovery' }
              });
            }
          }
        ]
      );
    } catch (err) {
      showError('Error', 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    let authSucceeded = false;
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || (userInfo as any).idToken;

      if (!idToken) {
        throw new Error('No ID token present from Google Sign-In.');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;

      if (data?.user) {
        authSucceeded = true;
        await handlePostAuthNavigation(data.user);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err.code !== 'SIGN_IN_CANCELLED' && err.message !== 'Sign in action cancelled') {
        showError('Google Sign-In Failed', err.message || 'An unexpected error occurred during Google authentication.');
      } else {
        showError('Google Sign-In Cancelled', 'Did you change your mind? You can sign in using your Google account to instantly link your profile.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.bg.page }]} edges={['top', 'bottom']}>
      <StatusBar 
        barStyle={theme.dark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.bg.page} 
        translucent={false} 
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Top Bar: Icon-only Back button (Section 7.3) */}
        <View style={styles.topBar}>
        <TouchableOpacity 
          style={[styles.backBtn, { 
            backgroundColor: theme.colors.bg.subtle,
            borderRadius: theme.radius.full 
          }]} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header: left-aligned welcome headers (Section 3.3) */}
        <View style={styles.header}>
          <View style={[styles.logoWrap, { 
            backgroundColor: theme.colors.brand.subtle,
            borderRadius: theme.radius.md 
          }]}>
            <Drop size={24} color={theme.colors.brand.default} weight="fill" />
          </View>
          <Text style={[styles.headerTitle, { 
            fontFamily: theme.typography.h1.fontFamily,
            color: theme.colors.text.primary 
          }]}>Welcome back</Text>
          
          <Text style={[styles.headerSubtitle, { 
            fontFamily: theme.typography.body.fontFamily,
            color: theme.colors.text.secondary 
          }]}>
            Sign in to continue managing your donor profile.
          </Text>
        </View>

        {/* Form Layout: Single column (Section 7.3) */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { 
              fontFamily: theme.typography.caption.fontFamily,
              color: theme.colors.text.secondary 
            }]}>EMAIL ADDRESS</Text>
            
            <View style={[styles.inputWrap, { 
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.subtle,
              borderRadius: theme.radius.md,
            }]}>
              <Envelope size={20} color={theme.colors.text.secondary} style={{ marginRight: 12 }} />
              <TextInput
                ref={emailRef}
                style={[styles.input, { 
                  fontFamily: theme.typography.body.fontFamily,
                  color: theme.colors.text.primary 
                }]}
                placeholder="name@example.com"
                placeholderTextColor={theme.colors.text.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { 
                fontFamily: theme.typography.caption.fontFamily,
                color: theme.colors.text.secondary 
              }]}>PASSWORD</Text>
              
              <TouchableOpacity onPress={handleForgotPassword} disabled={isLoading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.forgotText, { 
                  fontFamily: theme.typography.caption.fontFamily,
                  color: theme.colors.brand.default 
                }]}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            
            <View style={[styles.inputWrap, { 
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.subtle,
              borderRadius: theme.radius.md,
            }]}>
              <Lock size={20} color={theme.colors.text.secondary} style={{ marginRight: 12 }} />
              <TextInput
                ref={passwordRef}
                style={[styles.inputFlex, { 
                  fontFamily: theme.typography.body.fontFamily,
                  color: theme.colors.text.primary 
                }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.colors.text.tertiary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <Eye size={20} color={theme.colors.text.secondary} />
                ) : (
                  <EyeClosed size={20} color={theme.colors.text.secondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.bottomArea}>
          <TouchableOpacity 
            style={[styles.primaryBtn, { 
              backgroundColor: theme.colors.brand.default,
              borderRadius: theme.radius.md 
            }]} 
            onPress={handleLogin} 
            disabled={isLoading} 
            activeOpacity={0.8}
          >
            {isLoading ? (
              <CustomLoader size="small" color={theme.colors.text.onColor} />
            ) : (
              <Text style={[styles.primaryBtnText, { 
                fontFamily: theme.typography.bodyLg.fontFamily,
                color: theme.colors.text.onColor 
              }]}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: theme.colors.border.subtle }]} />
            <Text style={[styles.orText, { 
              fontFamily: theme.typography.caption.fontFamily,
              color: theme.colors.text.tertiary 
            }]}>OR</Text>
            <View style={[styles.orLine, { backgroundColor: theme.colors.border.subtle }]} />
          </View>

          {/* Continue with Google: Outline button */}
          <TouchableOpacity 
            style={[styles.ghostBtn, { 
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.default,
              borderRadius: theme.radius.md 
            }]} 
            onPress={handleGoogleLogin} 
            disabled={isLoading} 
            activeOpacity={0.7}
          >
            <Text style={[styles.ghostBtnText, { 
              fontFamily: theme.typography.bodyLg.fontFamily,
              color: theme.colors.text.primary 
            }]}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.redirectRow}>
            <Text style={[styles.redirectLabel, { 
              fontFamily: theme.typography.body.fontFamily,
              color: theme.colors.text.secondary 
            }]}>Don't have an account? </Text>
            <TouchableOpacity 
              onPress={() => router.push('/auth/signup')} 
              disabled={isLoading}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Text style={[styles.redirectLink, { 
                fontFamily: theme.typography.bodyLg.fontFamily,
                color: theme.colors.brand.default 
              }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Error Notification Modal */}
      <Modal
        visible={errorVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setErrorVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { 
            backgroundColor: theme.colors.bg.surfaceRaised,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
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
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setErrorVisible(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.errorCloseText, { 
                fontFamily: theme.typography.bodyLg.fontFamily,
                color: theme.colors.text.onColor 
              }]}>Acknowledge</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isLoading && (
        <CustomLoader 
          overlay 
          message="Logging in to Veno..." 
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  header: {
    alignItems: 'flex-start', // left aligned
    marginTop: 8,
    marginBottom: 28,
  },
  logoWrap: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  form: {},
  fieldGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  forgotText: {
    fontSize: 12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  inputFlex: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 8,
  },
  bottomArea: {
    marginTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
  },
  primaryBtn: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    letterSpacing: 0.3,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  orLine: {
    flex: 1,
    height: 1.5,
  },
  orText: {
    marginHorizontal: 16,
    fontSize: 12,
    letterSpacing: 1,
  },
  ghostBtn: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  ghostBtnText: {
    fontSize: 15,
  },
  redirectRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  redirectLabel: {
    fontSize: 14,
  },
  redirectLink: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    alignItems: 'center',
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
  bottomSheetHandle: {
    width: 38,
    height: 4,
    backgroundColor: 'rgba(150, 150, 150, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
});
