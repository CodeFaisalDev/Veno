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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { 
  ArrowLeft, 
  Eye, 
  EyeClosed, 
  Drop,
  User,
  Envelope,
  Lock,
  ShieldWarning
} from 'phosphor-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useTheme } from '../../theme';
import CustomLoader from '../../components/CustomLoader';

WebBrowser.maybeCompleteAuthSession();

GoogleSignin.configure({
  webClientId: '229379410387-tsf4mvo3dbvtnri9heo7p0aq4fqbi5iv.apps.googleusercontent.com',
  offlineAccess: true,
});

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [errorVisible, setErrorVisible] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const showError = (title: string, message: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setErrorTitle(title);
    setErrorMessage(message);
    setErrorVisible(true);
  };

  const handleSignUp = async () => {
    if (!fullName.trim()) {
      showError('Validation Error', 'Please enter your full name.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      showError('Validation Error', 'Please complete all fields.');
      return;
    }
    if (password.length < 6) {
      showError('Validation Error', 'Password must be at least 6 characters.');
      return;
    }
    if (!termsAccepted) {
      showError('Terms Required', 'Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setIsLoading(true);
    try {
      if (email.trim().endsWith('@veno.test')) {
        const { error: existingSignInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (!existingSignInError) return;

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: { data: { full_name: fullName.trim() } },
        });

        if (error) {
          const errMsg = error.message.toLowerCase();
          if (errMsg.includes('sending confirmation') || errMsg.includes('smtp') || errMsg.includes('email')) {
            Alert.alert('Developer Mode', 'Email delivery skipped for test domain.');
            router.push({ pathname: '/auth/otp', params: { email: email.trim(), type: 'signup', bypass: 'true' } });
            return;
          }
          if (errMsg.includes('already registered') || errMsg.includes('already been registered')) {
            Alert.alert('Account Exists', 'This email is already registered. Please sign in instead.');
            router.push('/auth/login');
            return;
          }
          showError('Account Creation Failed', error.message);
          return;
        }

        const { error: autoSignInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (autoSignInError) {
          Alert.alert('Developer Mode', 'Bypassing SMTP. Redirecting to verification...');
          router.push({ pathname: '/auth/otp', params: { email: email.trim(), type: 'signup', bypass: 'true' } });
          return;
        }
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: { data: { full_name: fullName.trim() } },
      });

      if (error) {
        showError('Account Creation Failed', error.message);
        return;
      }

      Alert.alert('Code Sent', 'A 6-digit confirmation code was sent to your email.');
      router.push({ pathname: '/auth/otp', params: { email: email.trim(), type: 'signup' } });
    } catch (err) {
      showError('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || (userInfo as any).idToken;

      if (!idToken) {
        throw new Error('No ID token present from Google Sign-In.');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err.code !== 'SIGN_IN_CANCELLED' && err.message !== 'Sign in action cancelled') {
        showError('Google Sign-Up Failed', err.message || 'An unexpected error occurred during Google authentication.');
      } else {
        showError('Google Sign-Up Cancelled', 'Did you change your mind? Sign up with your Google account to create your Veno profile instantly.');
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
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
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
          }]}>Create Account</Text>
          <Text style={[styles.headerSubtitle, { 
            fontFamily: theme.typography.body.fontFamily,
            color: theme.colors.text.secondary 
          }]}>
            Join Veno to start managing your journey.
          </Text>
        </View>

        <View style={styles.form}>
          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { 
              fontFamily: theme.typography.caption.fontFamily,
              color: theme.colors.text.secondary 
            }]}>FULL NAME</Text>
            
            <View style={[styles.inputWrap, { 
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.subtle,
              borderRadius: theme.radius.md,
            }]}>
              <User size={20} color={theme.colors.text.secondary} style={{ marginRight: 12 }} />
              <TextInput
                ref={nameRef}
                style={[styles.input, { 
                  fontFamily: theme.typography.body.fontFamily,
                  color: theme.colors.text.primary 
                }]}
                placeholder="John Doe"
                placeholderTextColor={theme.colors.text.tertiary}
                value={fullName}
                onChangeText={setFullName}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Email Address */}
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

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { 
              fontFamily: theme.typography.caption.fontFamily,
              color: theme.colors.text.secondary 
            }]}>PASSWORD</Text>
            
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
                placeholder="Min. 6 characters"
                placeholderTextColor={theme.colors.text.tertiary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeClosed size={20} color={theme.colors.text.secondary} />
                ) : (
                  <Eye size={20} color={theme.colors.text.secondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Terms checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setTermsAccepted(!termsAccepted)}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <View style={[
              styles.checkbox, 
              { 
                borderColor: theme.colors.border.default,
                borderRadius: theme.radius.sm 
              },
              termsAccepted && {
                backgroundColor: theme.colors.brand.default,
                borderColor: theme.colors.brand.default
              }
            ]}>
              {termsAccepted && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={[styles.checkboxLabel, { 
              fontFamily: theme.typography.bodySm.fontFamily,
              color: theme.colors.text.secondary 
            }]}>
              I agree to the{' '}
              <Text style={{ color: theme.colors.brand.default, fontFamily: theme.typography.bodyLg.fontFamily }}>Terms of Service</Text> and{' '}
              <Text style={{ color: theme.colors.brand.default, fontFamily: theme.typography.bodyLg.fontFamily }}>Privacy Policy</Text>.
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Pinned to bottom Area */}
      <View style={[styles.bottomArea, { backgroundColor: theme.colors.bg.page }]}>
        <TouchableOpacity
          style={[
            styles.primaryBtn, 
            { borderRadius: theme.radius.md },
            termsAccepted ? {
              backgroundColor: theme.colors.brand.default,
            } : {
              backgroundColor: theme.colors.border.strong,
              opacity: 0.45,
            }
          ]}
          onPress={handleSignUp}
          disabled={isLoading || !termsAccepted}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <CustomLoader size="small" color={theme.colors.text.onColor} />
          ) : (
            <Text style={[styles.primaryBtnText, { 
              fontFamily: theme.typography.bodyLg.fontFamily,
              color: theme.colors.text.onColor 
            }]}>Create Account</Text>
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

        <TouchableOpacity 
          style={[styles.ghostBtn, { 
            backgroundColor: theme.colors.bg.surface,
            borderColor: theme.colors.border.default,
            borderRadius: theme.radius.md 
          }]} 
          onPress={handleGoogleSignUp} 
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
          }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/login')} disabled={isLoading}>
            <Text style={[styles.redirectLink, { 
              fontFamily: theme.typography.bodyLg.fontFamily,
              color: theme.colors.brand.default 
            }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>

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
          message="Creating your Veno profile..." 
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
  label: {
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 0.5,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkMark: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  bottomArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
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
