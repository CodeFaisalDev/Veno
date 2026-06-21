import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, Line, G } from 'react-native-svg';
import {
  ArrowRight,
  Bell,
  Drop,
  MapPin,
  User,
} from 'phosphor-react-native';
import { useTheme } from '../../theme';

const { width } = Dimensions.get('window');

function FadeInUp({
  delay = 0,
  active,
  children,
}: {
  delay?: number;
  active: boolean;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (active) {
      opacity.setValue(0);
      translateY.setValue(24);
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }, delay);
      return () => clearTimeout(timer);
    } else {
      opacity.setValue(0);
      translateY.setValue(24);
    }
  }, [active, delay, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function PulsingRing({ size = 120 }) {
  const theme = useTheme();
  const scale1 = useRef(new Animated.Value(0.8)).current;
  const opacity1 = useRef(new Animated.Value(0.5)).current;
  const scale2 = useRef(new Animated.Value(0.8)).current;
  const opacity2 = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const createPulse = (s: Animated.Value, o: Animated.Value, d: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(d),
          Animated.parallel([
            Animated.timing(s, { toValue: 2.2, duration: 2500, useNativeDriver: true }),
            Animated.timing(o, { toValue: 0, duration: 2500, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(s, { toValue: 0.8, duration: 0, useNativeDriver: true }),
            Animated.timing(o, { toValue: 0.5, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
    createPulse(scale1, opacity1, 0).start();
    createPulse(scale2, opacity2, 1200).start();
  }, [scale1, opacity1, scale2, opacity2]);

  return (
    <View style={{ position: 'absolute', width: size, height: size }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: theme.colors.text.primary,
          opacity: opacity1,
          transform: [{ scale: scale1 }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: theme.colors.text.primary,
          opacity: opacity2,
          transform: [{ scale: scale2 }],
        }}
      />
    </View>
  );
}
export default function IntroScreen() {
  const theme = useTheme();
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollViewRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  const totalSlides = 4;

  const handleScroll = useCallback((event: any) => {
    const idx = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveSlide(idx);
  }, []);

  const goNext = () => {
    if (activeSlide < totalSlides - 1) {
      scrollViewRef.current?.scrollTo({ x: (activeSlide + 1) * width, animated: true });
    }
  };

  // ─── SLIDE 1: Welcome Splash ───
  const SlideWelcome = () => (
    <View style={[styles.slide, { justifyContent: 'center' }]}>
      <FadeInUp active={activeSlide === 0}>
        <View style={[styles.welcomeIconWrap, { backgroundColor: theme.colors.brand.default }]}>
          <Drop size={32} color="#FFF" weight="fill" />
        </View>
      </FadeInUp>

      <FadeInUp delay={250} active={activeSlide === 0}>
        <Text style={[styles.welcomeTitle, { 
          fontFamily: theme.typography.display.fontFamily,
          color: theme.colors.text.primary 
        }]}>Veno</Text>
      </FadeInUp>

      <FadeInUp delay={500} active={activeSlide === 0}>
        <Text style={[styles.welcomeTagline, { 
          fontFamily: theme.typography.bodyLg.fontFamily,
          color: theme.colors.text.secondary 
        }]}>Vitality without Anxiety</Text>
      </FadeInUp>

      <FadeInUp delay={750} active={activeSlide === 0}>
        <Text style={[styles.welcomeHint, { 
          fontFamily: theme.typography.body.fontFamily,
          color: theme.colors.text.secondary 
        }]}>Swipe to explore  →</Text>
      </FadeInUp>
    </View>
  );

  // ─── SLIDE 2: Fast Matching Radar ───
  const SlideMatching = () => (
    <View style={styles.slide}>
      <View style={styles.skipRow}>
        <TouchableOpacity onPress={() => router.push('/auth/login')}>
          <Text style={[styles.skipText, { 
            fontFamily: theme.typography.caption.fontFamily,
            color: theme.colors.text.secondary 
          }]}>SKIP</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.radarContainer}>
        <View style={styles.gridBg}>
          <Svg width={280} height={280} viewBox="0 0 280 280">
            {[0, 40, 80, 120, 160, 200, 240, 280].map((v) => (
              <G key={v}>
                <Line x1={v} y1={0} x2={v} y2={280} stroke={theme.colors.border.subtle} strokeWidth={0.5} />
                <Line x1={0} y1={v} x2={280} y2={v} stroke={theme.colors.border.subtle} strokeWidth={0.5} />
              </G>
            ))}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
              const rad = (angle * Math.PI) / 180;
              return (
                <Line
                  key={angle}
                  x1={140}
                  y1={140}
                  x2={140 + 130 * Math.cos(rad)}
                  y2={140 + 130 * Math.sin(rad)}
                  stroke={theme.colors.border.subtle}
                  strokeWidth={0.3}
                />
              );
            })}
            <Circle cx={140} cy={140} r={40} fill="none" stroke={theme.colors.border.subtle} strokeWidth={0.5} />
            <Circle cx={140} cy={140} r={80} fill="none" stroke={theme.colors.border.subtle} strokeWidth={0.5} />
            <Circle cx={140} cy={140} r={120} fill="none" stroke={theme.colors.border.subtle} strokeWidth={0.5} />
          </Svg>
        </View>

        <PulsingRing size={120} />

        <View style={[styles.centralNode, { backgroundColor: theme.colors.text.primary }]}>
          <User size={22} color={theme.colors.bg.surface} weight="fill" />
        </View>

        <View style={[styles.donorNode, { 
          bottom: '18%', 
          left: '8%',
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.text.primary,
        }]}>
          <Drop size={18} color={theme.colors.brand.default} weight="fill" />
          <View style={[styles.distanceBadge, { backgroundColor: theme.colors.text.primary }]}>
            <Text style={[styles.distanceText, { color: theme.colors.bg.surface }]}>0.2 MI</Text>
          </View>
        </View>

        <View style={[styles.donorNodeSmall, { 
          top: '15%', 
          right: '12%',
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        }]}>
          <Drop size={12} color={theme.colors.text.secondary} weight="regular" />
        </View>

        <Svg
          style={{ position: 'absolute', width: '100%', height: '100%' }}
          viewBox="0 0 300 300"
        >
          <Line x1={150} y1={150} x2={55} y2={220} stroke={theme.colors.text.primary} strokeWidth={2} />
          <Line
            x1={150}
            y1={150}
            x2={235}
            y2={70}
            stroke={theme.colors.text.primary}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.3}
          />
        </Svg>
      </View>

      <View style={styles.slideBottomContent}>
        <FadeInUp active={activeSlide === 1}>
          <Text style={[styles.slideHeadline, { 
            fontFamily: theme.typography.h1.fontFamily,
            color: theme.colors.text.primary 
          }]}>
            Matches in{'\n'}Milliseconds.
          </Text>
        </FadeInUp>
        <FadeInUp delay={200} active={activeSlide === 1}>
          <Text style={[styles.slideBody, { 
            fontFamily: theme.typography.body.fontFamily,
            color: theme.colors.text.secondary 
          }]}>
            Our high-speed network continuously scans your immediate vicinity, locking onto compatible donors the moment you need them.
          </Text>
        </FadeInUp>
      </View>
    </View>
  );

  // ─── SLIDE 3: Stay Notified ───
  const SlideNotified = () => (
    <View style={styles.slide}>
      <View style={styles.skipRow}>
        <TouchableOpacity onPress={() => router.push('/auth/login')}>
          <Text style={[styles.skipText, { 
            fontFamily: theme.typography.caption.fontFamily,
            color: theme.colors.text.secondary 
          }]}>SKIP</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.notifiedIllustrationArea, { backgroundColor: theme.colors.bg.subtle }]}>
        <View style={styles.bellCircle}>
          <Bell size={48} color={theme.colors.brand.default} weight="regular" />
        </View>
      </View>

      <View style={styles.notifiedContent}>
        <View style={[styles.notifiedIconSmall, { backgroundColor: theme.colors.brand.subtle }]}>
          <Bell size={16} color={theme.colors.brand.default} weight="fill" />
        </View>
        <Text style={[styles.slideHeadline, { 
          fontFamily: theme.typography.h1.fontFamily,
          color: theme.colors.text.primary,
          textAlign: 'left'
        }]}>Stay Notified</Text>
        
        <Text style={[styles.slideBody, { 
          fontFamily: theme.typography.body.fontFamily,
          color: theme.colors.text.secondary,
          textAlign: 'left',
          paddingHorizontal: 0
        }]}>
          Never miss an important update, exclusive offer, or critical alert. Turn on push notifications to stay seamlessly connected to what matters.
        </Text>

        <View style={[styles.toggleRow, { borderTopColor: theme.colors.border.subtle }]}>
          <View style={styles.toggleLeft}>
            <Text style={[styles.toggleTitle, { 
              fontFamily: theme.typography.h3.fontFamily,
              color: theme.colors.text.primary 
            }]}>Push Notifications</Text>
            <Text style={[styles.toggleSubtitle, { 
              fontFamily: theme.typography.bodySm.fontFamily,
              color: theme.colors.text.secondary 
            }]}>Receive alerts on your device</Text>
          </View>
          <View style={[styles.toggleTrack, { backgroundColor: theme.colors.brand.default }]}>
            <View style={styles.toggleThumb} />
          </View>
        </View>
      </View>
    </View>
  );

  // ─── SLIDE 4: Login or Sign Up ───
  const SlideAuth = () => (
    <View style={[styles.slide, { justifyContent: 'center' }]}>
      <FadeInUp active={activeSlide === 3}>
        <View style={{ alignItems: 'center' }}>
          <View style={[styles.authIconWrap, { backgroundColor: theme.colors.brand.default }]}>
            <Drop size={22} color="#FFF" weight="fill" />
          </View>
        </View>
      </FadeInUp>

      <FadeInUp delay={150} active={activeSlide === 3}>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.authTitle, { 
            fontFamily: theme.typography.display.fontFamily,
            color: theme.colors.text.primary 
          }]}>Veno</Text>
          <Text style={[styles.authSubtitle, { 
            fontFamily: theme.typography.bodyLg.fontFamily,
            color: theme.colors.text.secondary 
          }]}>Your journey starts here.</Text>
        </View>
      </FadeInUp>

      <FadeInUp delay={350} active={activeSlide === 3}>
        <View style={styles.authButtonsContainer}>
          <TouchableOpacity
            style={[styles.authPrimaryBtn, { 
              backgroundColor: theme.colors.brand.default,
              borderRadius: theme.radius.md 
            }]}
            onPress={() => router.push('/auth/signup')}
            activeOpacity={0.8}
          >
            <Text style={[styles.authPrimaryBtnText, { 
              fontFamily: theme.typography.bodyLg.fontFamily,
              color: theme.colors.text.onColor 
            }]}>Sign up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.authSecondaryBtn, { 
              borderColor: theme.colors.border.default,
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.md 
            }]}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.8}
          >
            <Text style={[styles.authSecondaryBtnText, { 
              fontFamily: theme.typography.bodyLg.fontFamily,
              color: theme.colors.text.primary 
            }]}>Log in</Text>
          </TouchableOpacity>

          <Text style={[styles.termsText, { 
            fontFamily: theme.typography.bodySm.fontFamily,
            color: theme.colors.text.secondary 
          }]}>
            By proceeding, you consent to our{' '}
            <Text style={{ color: theme.colors.brand.default, fontFamily: theme.typography.bodyLg.fontFamily }}>Terms of Service</Text> and acknowledge our{' '}
            <Text style={{ color: theme.colors.brand.default, fontFamily: theme.typography.bodyLg.fontFamily }}>Privacy Policy</Text>.
          </Text>
        </View>
      </FadeInUp>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg.page }]}>
      <StatusBar 
        barStyle={theme.dark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.bg.page} 
        translucent={false} 
      />
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: handleScroll }
        )}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        <View style={{ width }}><SlideWelcome /></View>
        <View style={{ width }}><SlideMatching /></View>
        <View style={{ width }}><SlideNotified /></View>
        <View style={{ width }}><SlideAuth /></View>
      </Animated.ScrollView>

      {/* Footer */}
      <View 
        style={[styles.footer, { opacity: activeSlide < 3 ? 1 : 0 }]} 
        pointerEvents={activeSlide < 3 ? 'auto' : 'none'}
      >
        <View style={styles.pagination}>
          {Array.from({ length: totalSlides }).map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 28, 8],
              extrapolate: 'clamp',
            });

            const dotBgColor = scrollX.interpolate({
              inputRange,
              outputRange: [theme.colors.border.subtle, theme.colors.text.primary],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={i}
                style={{
                  height: 8,
                  borderRadius: 4,
                  width: dotWidth,
                  backgroundColor: dotBgColor,
                }}
              />
            );
          })}
        </View>

        <TouchableOpacity 
          style={[styles.continueBtn, { 
            backgroundColor: theme.colors.text.primary,
            borderRadius: theme.radius.md 
          }]} 
          onPress={goNext}
          activeOpacity={0.8}
        >
          <Text style={[styles.continueBtnText, { 
            fontFamily: theme.typography.caption.fontFamily,
            color: theme.colors.bg.surface 
          }]}>CONTINUE</Text>
          <ArrowRight size={16} color={theme.colors.bg.surface} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  skipRow: {
    width: '100%',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingRight: 4,
  },
  skipText: {
    fontSize: 12,
    letterSpacing: 1.5,
  },
  welcomeIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 48,
    textAlign: 'center',
    letterSpacing: -1,
  },
  welcomeTagline: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 28,
  },
  welcomeHint: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 48,
    letterSpacing: 0.5,
  },
  radarContainer: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginTop: 12,
  },
  gridBg: {
    position: 'absolute',
    opacity: 0.5,
  },
  centralNode: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  donorNode: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  distanceBadge: {
    position: 'absolute',
    top: -14,
    right: -28,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  distanceText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  donorNodeSmall: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  slideBottomContent: {
    width: '100%',
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  slideHeadline: {
    fontSize: 28,
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  slideBody: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  notifiedIllustrationArea: {
    height: 200,
    width: '100%',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellCircle: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifiedContent: {
    width: '100%',
    paddingHorizontal: 4,
    paddingBottom: 16,
  },
  notifiedIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1.5,
  },
  toggleLeft: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
  },
  toggleSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  toggleTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 3,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
  },
  authIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  authTitle: {
    fontSize: 42,
    letterSpacing: -1,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16,
    marginTop: 4,
    marginBottom: 40,
    textAlign: 'center',
  },
  authButtonsContainer: {
    width: width - 32,
    gap: 12,
  },
  authPrimaryBtn: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authPrimaryBtnText: {
    fontSize: 16,
    fontWeight: '500',
  },
  authSecondaryBtn: {
    height: 52,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authSecondaryBtnText: {
    fontSize: 16,
    fontWeight: '500',
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  continueBtn: {
    height: 52,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueBtnText: {
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
