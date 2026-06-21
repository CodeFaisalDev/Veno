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
} from 'react-native';
import CustomLoader from '../../components/CustomLoader';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { Lock, ArrowLeft, Eye, EyeClosed, Drop } from 'phosphor-react-native';
import { useTheme } from '../../theme';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleResetPassword = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      Alert.alert('Validation Error', 'Please fill in both password fields.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Validation Error', 'Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        Alert.alert('Reset Failed', error.message);
        return;
      }

      Alert.alert(
        'Password Updated',
        'Your password has been successfully reset. Please sign in with your new password.',
        [
          {
            text: 'Sign In',
            onPress: () => {
              supabase.auth.signOut().then(() => {
                router.replace('/auth/login');
              });
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
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
          disabled={isLoading}
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
        {/* Header */}
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
          }]}>Reset password</Text>
          <Text style={[styles.headerSubtitle, { 
            fontFamily: theme.typography.body.fontFamily,
            color: theme.colors.text.secondary 
          }]}>
            Enter your new secure password below.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { 
              fontFamily: theme.typography.caption.fontFamily,
              color: theme.colors.text.secondary 
            }]}>NEW PASSWORD</Text>
            
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
                placeholder="Min. 8 characters"
                placeholderTextColor={theme.colors.text.tertiary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { 
              fontFamily: theme.typography.caption.fontFamily,
              color: theme.colors.text.secondary 
            }]}>CONFIRM NEW PASSWORD</Text>
            
            <View style={[styles.inputWrap, { 
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.subtle,
              borderRadius: theme.radius.md,
            }]}>
              <Lock size={20} color={theme.colors.text.secondary} style={{ marginRight: 12 }} />
              <TextInput
                ref={confirmPasswordRef}
                style={[styles.inputFlex, { 
                  fontFamily: theme.typography.body.fontFamily,
                  color: theme.colors.text.primary 
                }]}
                placeholder="Confirm your password"
                placeholderTextColor={theme.colors.text.tertiary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
                editable={!isLoading}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed bottom */}
      <View style={[styles.bottomArea, { backgroundColor: theme.colors.bg.page }]}>
        <TouchableOpacity 
          style={[styles.primaryBtn, { 
            backgroundColor: theme.colors.brand.default,
            borderRadius: theme.radius.md 
          }]} 
          onPress={handleResetPassword} 
          disabled={isLoading} 
          activeOpacity={0.8}
        >
          {isLoading ? (
            <CustomLoader size="small" color={theme.colors.text.onColor} />
          ) : (
            <Text style={[styles.primaryBtnText, { 
              fontFamily: theme.typography.bodyLg.fontFamily,
              color: theme.colors.text.onColor 
            }]}>Reset Password</Text>
          )}
        </TouchableOpacity>
      </View>
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
});
