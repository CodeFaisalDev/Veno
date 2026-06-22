import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomLoader from '../../components/CustomLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { 
  ShareNetwork, 
  QrCode, 
  SealCheck, 
  Hourglass, 
  Trophy, 
  HeartStraight,
  Camera,
  WarningCircle,
  SignOut,
  Moon,
  Sun,
  Bell,
} from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AvatarImage from '../../components/AvatarImage';
import CustomModal from '../../components/CustomModal';
import { registerForPushNotificationsAsync } from '../../utils/notifications';
import AnimatedPressable from '../../components/AnimatedPressable';
import AnimatedScreenWrapper from '../../components/AnimatedScreenWrapper';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(base64: string): ArrayBuffer {
  const cleaned = base64.replace(/=+$/, '');
  const len = cleaned.length;
  const bufferLength = Math.floor(len * 0.75);
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = CHARS.indexOf(cleaned[i]);
    const encoded2 = CHARS.indexOf(cleaned[i + 1]);
    const encoded3 = i + 2 < len ? CHARS.indexOf(cleaned[i + 2]) : 0;
    const encoded4 = i + 3 < len ? CHARS.indexOf(cleaned[i + 3]) : 0;

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (i + 2 < len) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (i + 3 < len) {
      bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
    }
  }
  return arrayBuffer;
}

interface UserProfile {
  id: string;
  full_name: string;
  blood_group: string;
  points: number;
  verification_badge: boolean;
  division: string;
  district: string;
  upazila: string;
  created_at?: string;
  avatar_url?: string | null;
}

interface DonorStatus {
  state: string;
  donation_cooldown_until: string | null;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [donorStatus, setDonorStatus] = useState<DonorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qrMatrix, setQrMatrix] = useState<boolean[][]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Custom Modal Alert State
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

  const generateMockQR = () => {
    // 14x14 matrix for 56px size (4px per cell)
    const size = 14;
    const matrix: boolean[][] = [];
    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < size; c++) {
        // Render alignment patterns on corners
        const isTopLeft = r < 4 && c < 4;
        const isTopRight = r < 4 && c > 9;
        const isBottomLeft = r > 9 && c < 4;
        
        if (isTopLeft || isTopRight || isBottomLeft) {
          const innerR = isTopLeft ? r : isTopRight ? r : r - 10;
          const innerC = isTopLeft ? c : isTopRight ? c - 10 : c;
          const isBorder = innerR === 0 || innerR === 3 || innerC === 0 || innerC === 3;
          const isCenter = innerR === 1.5 && innerC === 1.5; // simple approximation
          row.push(isBorder || isCenter);
        } else {
          // pseudo-random QR noise
          row.push(((r * 3 + c * 7) % 4 === 0) || ((r + c) % 3 === 0));
        }
      }
      matrix.push(row);
    }
    setQrMatrix(matrix);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(profileData);

        const { data: statusData } = await supabase
          .from('donor_statuses')
          .select('*')
          .eq('user_id', user.id)
          .single();
        setDonorStatus(statusData);

        // Load notifications settings
        const storedNotif = await AsyncStorage.getItem('notifications_enabled');
        if (storedNotif !== null) {
          setNotificationsEnabled(storedNotif === 'true');
        }

        generateMockQR();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showCustomAlert({
          title: 'Permission Denied',
          description: 'Library permissions are required to choose photo.',
          type: 'warning',
          onConfirm: () => setModalVisible(false),
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        await handleUploadAvatar(selectedImage.uri);
      }
    } catch (e: any) {
      console.warn('Avatar picker failed:', e);
      showCustomAlert({
        title: 'Picker Error',
        description: 'An error occurred selecting photo.',
        type: 'danger',
        onConfirm: () => setModalVisible(false),
      });
    }
  };

  const handleUploadAvatar = async (imageUri: string) => {
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found.');

      // Read file as Base64 using expo-file-system/legacy
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert Base64 to ArrayBuffer
      const arrayBuffer = decodeBase64(base64);

      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `avatar_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to Supabase Storage bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Save public URL to profiles table
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (dbError) throw dbError;

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      
      showCustomAlert({
        title: 'Success',
        description: 'Profile photo updated successfully.',
        type: 'success',
        onConfirm: () => setModalVisible(false),
      });
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      showCustomAlert({
        title: 'Upload Failed',
        description: err.message || 'Failed to upload image.',
        type: 'danger',
        onConfirm: () => setModalVisible(false),
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    showCustomAlert({
      title: 'Log Out',
      description: 'Are you sure you want to log out of Veno?',
      confirmText: 'Log Out',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setModalVisible(false);
        setIsLoading(true);
        await supabase.auth.signOut();
      },
      onCancel: () => setModalVisible(false)
    });
  };

  const handleShareCard = () => {
    showCustomAlert({
      title: 'Share Card',
      description: 'Your Digital Donor Card link has been copied to clipboard!',
      type: 'success',
      onConfirm: () => setModalVisible(false),
    });
  };

  const handleToggleNotifications = async (value: boolean) => {
    try {
      setNotificationsEnabled(value);
      await AsyncStorage.setItem('notifications_enabled', value ? 'true' : 'false');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!value) {
        // Clear token from DB if disabled
        await supabase
          .from('profiles')
          .update({ push_token: null })
          .eq('id', user.id);
      } else {
        // Re-enable (register token if allowed)
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await supabase
            .from('profiles')
            .update({ push_token: token })
            .eq('id', user.id);
        }
      }
    } catch (e) {
      console.warn('Failed to update push notification toggle state:', e);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.bg.page }]}>
        <CustomLoader message="Loading Veno Profile..." />
      </View>
    );
  }

  let cooldownDays = 0;
  if (donorStatus?.donation_cooldown_until) {
    const cooldownDate = new Date(donorStatus.donation_cooldown_until);
    const today = new Date();
    const diffTime = cooldownDate.getTime() - today.getTime();
    cooldownDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const donorYear = profile?.created_at 
    ? new Date(profile.created_at).getFullYear() 
    : new Date().getFullYear();
    
  const donationCount = profile?.points 
    ? Math.max(1, Math.floor(profile.points / 100)) 
    : 1;

  return (
    <AnimatedScreenWrapper style={{ backgroundColor: theme.colors.bg.page }} screenIndex={2}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.page }]} edges={['top']}>
      <StatusBar 
        barStyle={theme.dark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.bg.page} 
      />
      
      {/* Header (Section 7.10 - blends with page bg, styled using h1) */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { 
          fontFamily: theme.typography.h1.fontFamily,
          color: theme.colors.text.primary,
        }]}>Donor Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Digital Identity Card (Section 7.11 - landscape 320x200 styling, gradient, DM Mono blood label) */}
        <View style={styles.cardWrapper}>
          <LinearGradient
            colors={[theme.colors.brand.default, theme.primitives.red[700]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.identityCard, { borderRadius: theme.radius.xl }]}
          >
            {/* Top row */}
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.cardBrand, { fontFamily: theme.typography.caption.fontFamily }]}>
                  VENO NETWORK
                </Text>
                <Text style={[styles.cardSubtitle, { fontFamily: theme.typography.caption.fontFamily }]}>
                  SECURE DONOR PROFILE
                </Text>
              </View>
              {profile?.verification_badge && (
                <View style={styles.verifiedBadge}>
                  <SealCheck size={16} color="#FFF" weight="fill" />
                  <Text style={[styles.verifiedText, { fontFamily: theme.typography.badge.fontFamily }]}>
                    VERIFIED
                  </Text>
                </View>
              )}
            </View>

            {/* Middle row */}
            <View style={styles.cardMiddle}>
              <View style={styles.cardMiddleTextContainer}>
                <Text style={[styles.cardName, { fontFamily: theme.typography.body.fontFamily }]} numberOfLines={1}>
                  {profile?.full_name?.toUpperCase() || 'NEW DONOR'}
                </Text>
                <Text style={[styles.cardLocation, { fontFamily: theme.typography.bodySm.fontFamily }]}>
                  {profile?.upazila ? `${profile.upazila}, ${profile.district}` : 'Dhaka, Bangladesh'}
                </Text>
              </View>
              <View style={[styles.bloodBadge, { borderRadius: theme.radius.md }]}>
                <Text style={[styles.bloodText, { fontFamily: theme.typography.blood.fontFamily, color: theme.colors.brand.default }]}>
                  {profile?.blood_group || 'O+'}
                </Text>
              </View>
            </View>

            {/* Bottom row */}
            <View style={styles.cardFooter}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardInfoTitle, { fontFamily: theme.typography.caption.fontFamily }]}>
                  DONATIONS
                </Text>
                <Text style={[styles.cardInfoVal, { fontFamily: theme.typography.bodySm.fontFamily }]}>
                  {donationCount} drops • Since {donorYear}
                </Text>
              </View>
              
              {/* QR Code component embedded in bottom-right corner */}
              <View style={[styles.qrCodeContainer, { borderRadius: theme.radius.sm }]}>
                {qrMatrix.map((row, rIdx) => (
                  <View key={rIdx} style={styles.qrRow}>
                    {row.map((pixel, cIdx) => (
                      <View
                        key={cIdx}
                        style={[
                          styles.qrPixel,
                          { backgroundColor: pixel ? '#0D0B09' : 'transparent' }
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* User profile photo selector */}
        <View style={styles.avatarSection}>
          <TouchableOpacity 
            style={[styles.avatarWrapper, { borderColor: theme.colors.border.subtle }]} 
            onPress={handlePickAvatar}
            disabled={isUploading}
            activeOpacity={0.8}
          >
            <AvatarImage 
              uri={profile?.avatar_url} 
              size={90} 
              borderWidth={2}
              borderColor={profile?.verification_badge ? theme.colors.status.active : theme.colors.border.default}
            />
            <View style={[styles.cameraOverlay, { backgroundColor: theme.colors.brand.default }]}>
              {isUploading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Camera size={14} color="#FFF" weight="fill" />
              )}
            </View>
          </TouchableOpacity>
          
          <Text style={[styles.profileNameText, { 
            fontFamily: theme.typography.h2.fontFamily,
            color: theme.colors.text.primary 
          }]}>
            {profile?.full_name || 'Donor User'}
          </Text>
          
          {/* Badge Display */}
          {profile?.verification_badge ? (
            <View style={[styles.verificationPill, { backgroundColor: theme.colors.status.activeBg, borderColor: theme.colors.status.active + '20' }]}>
              <SealCheck size={14} color={theme.colors.status.active} weight="fill" />
              <Text style={[styles.verificationPillText, { color: theme.colors.status.activeText, fontFamily: theme.typography.badge.fontFamily }]}>
                VERIFIED IDENTITY
              </Text>
            </View>
          ) : (
            <AnimatedPressable 
              style={[styles.verificationPill, { backgroundColor: theme.colors.status.criticalBg, borderColor: theme.colors.status.critical + '20' }]}
              onPress={() => router.push('/verify/nid-upload')}
            >
              <WarningCircle size={14} color={theme.colors.status.critical} weight="fill" />
              <Text style={[styles.verificationPillText, { color: theme.colors.status.criticalText, fontFamily: theme.typography.badge.fontFamily }]}>
                NOT VERIFIED (TAP TO VERIFY)
              </Text>
            </AnimatedPressable>
          )}
        </View>

        {/* Action button row (Section 7.11 outline buttons) */}
        <View style={styles.actionsRow}>
          <AnimatedPressable 
            style={[styles.actionButton, { 
              borderRadius: theme.radius.md,
              borderColor: theme.colors.border.default,
              backgroundColor: theme.colors.bg.surface,
            }]} 
            onPress={handleShareCard}
          >
            <ShareNetwork size={16} color={theme.colors.text.primary} />
            <Text style={[styles.actionBtnText, { 
              fontFamily: theme.typography.body.fontFamily,
              color: theme.colors.text.primary 
            }]}>Share Link</Text>
          </AnimatedPressable>
          
          <AnimatedPressable 
            style={[styles.actionButton, { 
              borderRadius: theme.radius.md,
              borderColor: theme.colors.border.default,
              backgroundColor: theme.colors.bg.surface,
            }]} 
            onPress={() => {
              showCustomAlert({
                title: 'Saved',
                description: 'Saved offline to application cache.',
                type: 'success',
                onConfirm: () => setModalVisible(false),
              });
            }}
          >
            <QrCode size={16} color={theme.colors.text.primary} />
            <Text style={[styles.actionBtnText, { 
              fontFamily: theme.typography.body.fontFamily,
              color: theme.colors.text.primary 
            }]}>Save Offline</Text>
          </AnimatedPressable>
        </View>

        {/* Verification banner (Warm notification card) */}
        {!profile?.verification_badge && (
          <AnimatedPressable 
            style={[styles.verifyBanner, { 
              backgroundColor: theme.colors.brand.subtle,
              borderRadius: theme.radius.lg,
              borderColor: theme.colors.brand.default,
              borderWidth: theme.dark ? 0 : 1,
            }]} 
            onPress={() => router.push('/verify/nid-upload')}
          >
            <SealCheck size={20} color={theme.colors.brand.default} weight="regular" />
            <View style={styles.verifyTextContainer}>
              <Text style={[styles.verifyTitle, { 
                fontFamily: theme.typography.h3.fontFamily,
                color: theme.colors.text.primary 
              }]}>Verify Your Identity</Text>
              <Text style={[styles.verifyDesc, { 
                fontFamily: theme.typography.bodySm.fontFamily,
                color: theme.colors.text.secondary 
              }]}>
                Upload NID/Passport to earn your green verification badge and +100 points.
              </Text>
            </View>
          </AnimatedPressable>
        )}

        {/* Cooldown banner */}
        {cooldownDays > 0 && (
          <View style={[styles.cooldownBanner, { 
            backgroundColor: theme.colors.status.cooldownBg,
            borderRadius: theme.radius.lg,
            borderColor: theme.colors.border.subtle,
            borderWidth: theme.dark ? 0 : 1,
          }]}>
            <Hourglass size={20} color={theme.colors.status.cooldown} />
            <View style={styles.cooldownTextContainer}>
              <Text style={[styles.cooldownTitle, { 
                fontFamily: theme.typography.h3.fontFamily,
                color: theme.colors.text.primary 
              }]}>Recovery Cooldown Active</Text>
              <Text style={[styles.cooldownDesc, { 
                fontFamily: theme.typography.bodySm.fontFamily,
                color: theme.colors.text.secondary 
              }]}>
                You have {cooldownDays} days remaining before your next eligible donation window.
              </Text>
            </View>
          </View>
        )}

        {/* Preferences / Settings Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { 
            fontFamily: theme.typography.caption.fontFamily,
            color: theme.colors.text.secondary 
          }]}>Preferences</Text>
          
          <View style={[styles.settingsCard, { 
            backgroundColor: theme.colors.bg.surface,
            borderColor: theme.colors.border.subtle,
            borderRadius: theme.radius.lg,
            borderWidth: theme.dark ? 0 : 1,
            ...(!theme.dark ? theme.shadows.elevation1 : {}),
          }]}>
            {/* Theme selector row */}
            <View style={styles.settingsRow}>
              <View style={styles.settingsLabelCol}>
                <View style={styles.settingsIconTextRow}>
                  {theme.dark ? (
                    <Moon size={20} color={theme.colors.text.secondary} />
                  ) : (
                    <Sun size={20} color={theme.colors.text.secondary} />
                  )}
                  <Text style={[styles.settingsLabel, { 
                    fontFamily: theme.typography.body.fontFamily,
                    color: theme.colors.text.primary 
                  }]}>Theme Mode</Text>
                </View>
                <Text style={[styles.settingsSubLabel, { 
                  fontFamily: theme.typography.bodySm.fontFamily,
                  color: theme.colors.text.secondary 
                }]}>Adjust app theme settings</Text>
              </View>
              
              <View style={styles.themeModeButtonsContainer}>
                {(['light', 'dark', 'system'] as const).map((mode) => {
                  const isSelected = theme.themeMode === mode;
                  return (
                    <AnimatedPressable
                      key={mode}
                      onPress={() => theme.setThemeMode(mode)}
                      style={[
                        styles.themeModeBtn,
                        {
                          borderColor: isSelected ? theme.colors.brand.default : theme.colors.border.subtle,
                          backgroundColor: isSelected ? theme.colors.brand.subtle : 'transparent',
                          borderRadius: theme.radius.md,
                        }
                      ]}
                    >
                      <Text style={[
                        styles.themeModeBtnText,
                        {
                          color: isSelected ? theme.colors.brand.text : theme.colors.text.secondary,
                          fontWeight: isSelected ? '600' : '400',
                          fontFamily: theme.typography.caption.fontFamily,
                        }
                      ]}>
                        {mode.toUpperCase()}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.settingsSeparator, { backgroundColor: theme.colors.border.subtle }]} />

            {/* Notification toggle row */}
            <View style={styles.settingsRow}>
              <View style={styles.settingsLabelCol}>
                <View style={styles.settingsIconTextRow}>
                  <Bell size={20} color={theme.colors.text.secondary} />
                  <Text style={[styles.settingsLabel, { 
                    fontFamily: theme.typography.body.fontFamily,
                    color: theme.colors.text.primary 
                  }]}>Push Notifications</Text>
                </View>
                <Text style={[styles.settingsSubLabel, { 
                  fontFamily: theme.typography.bodySm.fontFamily,
                  color: theme.colors.text.secondary 
                }]}>Receive alerts for matching requests</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: theme.colors.border.strong, true: theme.colors.brand.default }}
                thumbColor={theme.colors.text.onColor}
                ios_backgroundColor={theme.colors.border.subtle}
              />
            </View>
          </View>
        </View>

        {/* Achievements Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { 
            fontFamily: theme.typography.caption.fontFamily,
            color: theme.colors.text.secondary 
          }]}>Unlocked Achievements</Text>
          
          <View style={styles.badgeRow}>
            <View style={[styles.badgeCard, { 
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.subtle,
              borderRadius: theme.radius.lg,
              borderWidth: theme.dark ? 0 : 1,
              ...theme.shadows.elevation1,
            }]}>
              <View style={[styles.badgeIconBg, { backgroundColor: theme.colors.brand.subtle }]}>
                <HeartStraight size={20} color={theme.colors.brand.default} weight="fill" />
              </View>
              <Text style={[styles.badgeTitle, { 
                fontFamily: theme.typography.h3.fontFamily,
                color: theme.colors.text.primary 
              }]}>First Drop</Text>
              <Text style={[styles.badgeDesc, { 
                fontFamily: theme.typography.bodySm.fontFamily,
                color: theme.colors.text.secondary 
              }]}>First donation registered</Text>
            </View>

            <View style={[styles.badgeCard, { 
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.subtle,
              borderRadius: theme.radius.lg,
              borderWidth: theme.dark ? 0 : 1,
              ...theme.shadows.elevation1,
            }]}>
              <View style={[styles.badgeIconBg, { backgroundColor: '#FFFBEB' }]}>
                <Trophy size={20} color="#D4A017" weight="regular" />
              </View>
              <Text style={[styles.badgeTitle, { 
                fontFamily: theme.typography.h3.fontFamily,
                color: theme.colors.text.primary 
              }]}>Guardian</Text>
              <Text style={[styles.badgeDesc, { 
                fontFamily: theme.typography.bodySm.fontFamily,
                color: theme.colors.text.secondary 
              }]}>Registered successfully</Text>
            </View>
          </View>
        </View>
        {/* Log Out Button */}
        <AnimatedPressable 
          style={[styles.logoutButton, { 
            borderRadius: theme.radius.md,
            borderColor: theme.colors.status.critical,
            backgroundColor: theme.colors.status.criticalBg,
          }]} 
          onPress={handleLogout}
        >
          <SignOut size={16} color={theme.colors.status.criticalText} />
          <Text style={[styles.logoutButtonText, { 
            fontFamily: theme.typography.body.fontFamily,
            color: theme.colors.status.criticalText 
          }]}>Log Out</Text>
        </AnimatedPressable>

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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 110,
  },
  cardWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  identityCard: {
    width: '100%',
    aspectRatio: 1.6, // landscape card
    padding: 20,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBrand: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1.5,
  },
  cardSubtitle: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  verifiedText: {
    fontSize: 8,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  cardMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  cardMiddleTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  cardName: {
    fontSize: 20,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  cardLocation: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  bloodBadge: {
    width: 48,
    height: 48,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloodText: {
    fontSize: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardInfoTitle: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.5,
  },
  cardInfoVal: {
    fontSize: 12,
    color: '#FFF',
    marginTop: 3,
  },
  qrCodeContainer: {
    padding: 6,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
  },
  qrRow: {
    flexDirection: 'row',
  },
  qrPixel: {
    width: 3.2,
    height: 3.2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  cooldownBanner: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  cooldownTextContainer: {
    flex: 1,
  },
  cooldownTitle: {
    fontSize: 14,
  },
  cooldownDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
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
  badgeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  badgeCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  badgeIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  badgeDesc: {
    fontSize: 11,
    textAlign: 'center',
  },
  verifyBanner: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  verifyTextContainer: {
    flex: 1,
  },
  verifyTitle: {
    fontSize: 14,
  },
  verifyDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  logoutButton: {
    height: 48,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 24,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarWrapper: {
    position: 'relative',
    borderRadius: 9999,
    borderWidth: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileNameText: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  verificationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  verificationPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  settingsCard: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingsLabelCol: {
    flex: 1,
    marginRight: 16,
  },
  settingsIconTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingsSubLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  settingsSeparator: {
    height: 1,
    width: '100%',
  },
  themeModeButtonsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  themeModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeModeBtnText: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
