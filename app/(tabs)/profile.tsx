import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import CustomLoader from '../../components/CustomLoader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { 
  ShareNetwork, 
  QrCode, 
  SealCheck, 
  Hourglass, 
  Trophy, 
  HeartStraight 
} from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';

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

        generateMockQR();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleShareCard = () => {
    Alert.alert('Share Card', 'Your Digital Donor Card link has been copied to clipboard!');
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

        {/* Action button row (Section 7.11 outline buttons) */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={[styles.actionButton, { 
              borderRadius: theme.radius.md,
              borderColor: theme.colors.border.default,
              backgroundColor: theme.colors.bg.surface,
            }]} 
            onPress={handleShareCard}
            activeOpacity={0.8}
          >
            <ShareNetwork size={16} color={theme.colors.text.primary} />
            <Text style={[styles.actionBtnText, { 
              fontFamily: theme.typography.body.fontFamily,
              color: theme.colors.text.primary 
            }]}>Share Link</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { 
              borderRadius: theme.radius.md,
              borderColor: theme.colors.border.default,
              backgroundColor: theme.colors.bg.surface,
            }]} 
            onPress={() => Alert.alert('Saved', 'Saved offline to application cache.')}
            activeOpacity={0.8}
          >
            <QrCode size={16} color={theme.colors.text.primary} />
            <Text style={[styles.actionBtnText, { 
              fontFamily: theme.typography.body.fontFamily,
              color: theme.colors.text.primary 
            }]}>Save Offline</Text>
          </TouchableOpacity>
        </View>

        {/* Verification banner (Warm notification card) */}
        {!profile?.verification_badge && (
          <TouchableOpacity 
            style={[styles.verifyBanner, { 
              backgroundColor: theme.colors.brand.subtle,
              borderRadius: theme.radius.lg,
              borderColor: theme.colors.brand.default,
              borderWidth: theme.dark ? 0 : 1,
            }]} 
            onPress={() => router.push('/verify/nid-upload')}
            activeOpacity={0.8}
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
          </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
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
});
