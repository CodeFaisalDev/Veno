import React, { useState, useEffect, useRef } from 'react';
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
  StatusBar,
} from 'react-native';
import CustomLoader from '../../components/CustomLoader';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { ArrowLeft, ShieldCheck } from 'phosphor-react-native';
import { useTheme } from '../../theme';

export default function OTPScreen() {
  const theme = useTheme();
  const { phone, email, type, bypass } = useLocalSearchParams<{ phone?: string; email?: string; type?: string; bypass?: string }>();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleDigitChange = (value: string, index: number) => {
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const otp = digits.join('');

  const handleVerifyOTP = async () => {
    if (otp.length < 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);

    try {
      if (bypass === 'true') {
        if (type === 'recovery') {
          router.replace('/auth/reset-password');
          return;
        }

        const mockEmail = email || `${phone?.replace('+', '')}@veno.test`;
        const tempPassword = 'VenoSecureTempPassword123!';

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: mockEmail,
          password: tempPassword,
        });

        if (signInError) {
          if (signInError.message.toLowerCase().includes('invalid login credentials') || signInError.message.toLowerCase().includes('not found')) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: mockEmail,
              password: tempPassword,
              options: {
                data: {
                  phone_number: phone || '+8801799999999',
                }
              }
            });

            if (signUpError) {
              Alert.alert('Verification Failed (Bypass Sign-up)', signUpError.message);
              return;
            }
          } else {
            Alert.alert('Verification Failed (Bypass Sign-in)', signInError.message);
            return;
          }
        }
        return;
      }

      if (email) {
        const verifyType = type === 'recovery' ? 'recovery' : (type as any) || 'email';
        const { data, error } = await supabase.auth.verifyOtp({
          email: email,
          token: otp,
          type: verifyType,
        });

        if (error) {
          Alert.alert('Verification Failed', error.message);
          return;
        }

        if (verifyType === 'recovery') {
          router.replace('/auth/reset-password');
        }
      } else if (phone) {
        const verifyType = type === 'phone_change' ? 'phone_change' : 'sms';
        const { data, error } = await supabase.auth.verifyOtp({
          phone: phone,
          token: otp,
          type: verifyType,
        });

        if (error) {
          Alert.alert('Verification Failed', error.message);
          return;
        }
      } else {
        Alert.alert('Error', 'No email or phone number found for verification.');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred during verification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer > 0) return;

    setIsLoading(true);
    try {
      if (email) {
        if (type === 'signup') {
          const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
          });
          if (error) {
            Alert.alert('Resend Failed', error.message);
            return;
          }
        } else {
          const { error } = await supabase.auth.signInWithOtp({
            email: email,
          });
          if (error) {
            Alert.alert('Resend Failed', error.message);
            return;
          }
        }
      } else if (phone) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: phone,
        });
        if (error) {
          Alert.alert('Resend Failed', error.message);
          return;
        }
      }

      setTimer(60);
      Alert.alert('Code Sent', `A new verification code has been sent to ${email || phone}.`);
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.page }]} edges={['top', 'bottom']}>
      <StatusBar 
        barStyle={theme.dark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.bg.page} 
        translucent={false} 
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
          {/* Header Bar */}
          <View style={styles.headerBar}>
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

          {/* Thin Brand Progress Bar */}
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border.subtle }]}>
            <View style={[styles.progressFill, { 
              backgroundColor: theme.colors.brand.default,
              width: '66%' 
            }]} />
          </View>

          {/* Left Aligned Content (Section 7.3) */}
          <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.brand.subtle }]}>
              <ShieldCheck size={28} color={theme.colors.brand.default} weight="regular" />
            </View>

            <Text style={[styles.title, { 
              fontFamily: theme.typography.h1.fontFamily,
              color: theme.colors.text.primary 
            }]}>Verify your email</Text>
            
            <Text style={[styles.subtitle, { 
              fontFamily: theme.typography.body.fontFamily,
              color: theme.colors.text.secondary 
            }]}>
              We've sent a 6-digit verification code to your email address. Please enter it below to confirm your account.
            </Text>

            {bypass === 'true' && (
              <View style={[styles.bypassBanner, { 
                backgroundColor: theme.colors.status.pendingBg,
                borderColor: theme.colors.status.pending,
                borderRadius: theme.radius.md
              }]}>
                <Text style={[styles.bypassText, { 
                  fontFamily: theme.typography.bodySm.fontFamily,
                  color: theme.colors.status.pendingText
                }]}>
                  ⚠️ Dev Mode: Enter any 6 digits to proceed.
                </Text>
              </View>
            )}

            {/* 6-digit OTP Inputs (10px rounded, Airbnb-style) */}
            <View style={styles.otpRow}>
              {digits.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
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
                  onChangeText={(val) => handleDigitChange(val, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  editable={!isLoading}
                  textAlign="center"
                />
              ))}
            </View>

            {/* Verify Button (Radius-md) */}
            <TouchableOpacity
              style={[
                styles.primaryBtn, 
                { borderRadius: theme.radius.md },
                otp.length === 6 ? {
                  backgroundColor: theme.colors.brand.default,
                } : {
                  backgroundColor: theme.colors.border.strong,
                  opacity: 0.5,
                }
              ]}
              onPress={handleVerifyOTP}
              disabled={isLoading || otp.length < 6}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <CustomLoader size="small" color={theme.colors.text.onColor} />
              ) : (
                <Text style={[styles.primaryBtnText, { 
                  fontFamily: theme.typography.bodyLg.fontFamily,
                  color: theme.colors.text.onColor 
                }]}>VERIFY CODE</Text>
              )}
            </TouchableOpacity>

            {/* Resend */}
            <View style={styles.resendRow}>
              <Text style={[styles.resendLabel, { 
                fontFamily: theme.typography.body.fontFamily,
                color: theme.colors.text.secondary 
              }]}>Didn't receive the code? </Text>
              <TouchableOpacity onPress={handleResendOTP} disabled={timer > 0 || isLoading}>
                <Text style={[
                  styles.resendLink, 
                  { fontFamily: theme.typography.bodyLg.fontFamily, color: theme.colors.brand.default },
                  timer > 0 && { color: theme.colors.text.tertiary }
                ]}>
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    height: 3,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  content: {
    flex: 1,
    alignItems: 'flex-start', // left aligned titles
    paddingHorizontal: 16,
    paddingTop: 36,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  bypassBanner: {
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 24,
    width: '100%',
  },
  bypassText: {
    fontSize: 13,
    textAlign: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
    width: '100%',
    justifyContent: 'space-between',
  },
  otpInput: {
    width: '14%',
    aspectRatio: 0.9,
    borderWidth: 1.5,
    fontSize: 20,
  },
  primaryBtn: {
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    letterSpacing: 0.5,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  resendLabel: {
    fontSize: 14,
  },
  resendLink: {
    fontSize: 14,
  },
});
