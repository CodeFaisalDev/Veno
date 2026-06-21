import React, { useState, useRef, useEffect } from 'react';
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
  DeviceEventEmitter
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ArrowRight, Drop, Users, MapTrifold, Trophy } from 'phosphor-react-native';
import { useTheme } from '../../theme';

const { width, height } = Dimensions.get('window');

function AnimatedDot({ active }: { active: boolean }) {
  const theme = useTheme();
  const widthAnim = useRef(new Animated.Value(active ? 28 : 8)).current;
  const bgAnim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(widthAnim, {
        toValue: active ? 28 : 8,
        friction: 8,
        tension: 80,
        useNativeDriver: false,
      }),
      Animated.timing(bgAnim, {
        toValue: active ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  }, [active, widthAnim, bgAnim]);

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border.subtle, theme.colors.text.primary],
  });

  return (
    <Animated.View
      style={{
        height: 8,
        borderRadius: 9999,
        width: widthAnim,
        backgroundColor,
      }}
    />
  );
}

interface Slide {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export default function HowToUseScreen() {
  const theme = useTheme();
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();

  const slides: Slide[] = [
    {
      id: '1',
      title: 'Find Nearby Requests',
      description: 'Check active notifications and matching blood requests fuzzed to secure approximate areas in your community dashboard.',
      icon: <Drop size={28} color={theme.colors.brand.default} weight="fill" />,
    },
    {
      id: '2',
      title: 'Join Response Queue',
      description: 'Tap Accept to enter a coordinate queue. Requester reviews ETAs, point history, and verified indicators.',
      icon: <Users size={28} color={theme.colors.brand.default} weight="regular" />,
    },
    {
      id: '3',
      title: 'Track Navigation Map',
      description: 'Once matched, follow directions directly on maps with Uber-style real-time live navigation tracking.',
      icon: <MapTrifold size={28} color={theme.colors.brand.default} weight="regular" />,
    },
    {
      id: '4',
      title: 'Log Completions',
      description: 'Submit outcome confirmations, claim scores and points rewards, and start your recovery cooldown timers.',
      icon: <Trophy size={28} color={theme.colors.brand.default} weight="regular" />,
    },
  ];

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveSlide(slideIndex);
  };

  const handleNext = async () => {
    if (activeSlide < slides.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: (activeSlide + 1) * width,
        animated: true,
      });
    } else {
      await finishGuide();
    }
  };

  const finishGuide = async () => {
    try {
      await AsyncStorage.setItem('has_seen_guide', 'true');
      DeviceEventEmitter.emit('guideUpdated');
      router.replace('/(tabs)');
    } catch (e) {
      console.error(e);
    }
  };

  // Mockups styled to match Veno's premium aesthetic
  const renderMockup1 = () => (
    <View style={[s.mockCard, { 
      backgroundColor: theme.colors.bg.surface, 
      borderColor: theme.colors.border.subtle, 
      borderRadius: theme.radius.lg,
      borderWidth: theme.dark ? 0 : 1,
      ...theme.shadows.elevation1
    }]}>
      <View style={s.mockHeader}>
        <View style={[s.badgeUrgent, { backgroundColor: theme.colors.brand.subtle }]}>
          <View style={[s.pulseDot, { backgroundColor: theme.colors.brand.default }]} />
          <Text style={[s.badgeUrgentText, { 
            fontFamily: theme.typography.badge.fontFamily,
            color: theme.colors.brand.text 
          }]}>CRITICAL</Text>
        </View>
        <Text style={[s.mockTime, { 
          fontFamily: theme.typography.caption.fontFamily,
          color: theme.colors.text.secondary 
        }]}>Just Now</Text>
      </View>
      <View style={s.mockBody}>
        <Text style={[s.mockTitle, { 
          fontFamily: theme.typography.h3.fontFamily,
          color: theme.colors.text.primary 
        }]}>O- Negative Blood Needed</Text>
        <Text style={[s.mockDesc, { 
          fontFamily: theme.typography.bodySm.fontFamily,
          color: theme.colors.text.secondary 
        }]}>Required at Dhaka General Hospital</Text>
        
        <View style={[s.metaRow, { backgroundColor: theme.colors.bg.subtle }]}>
          <View style={s.metaCol}>
            <Text style={[s.metaLabel, { 
              fontFamily: theme.typography.caption.fontFamily,
              color: theme.colors.text.secondary 
            }]}>DISTANCE</Text>
            <Text style={[s.metaValue, { 
              fontFamily: theme.typography.body.fontFamily,
              color: theme.colors.text.primary 
            }]}>1.4 km nearby</Text>
          </View>
          <View style={[s.metaDivider, { backgroundColor: theme.colors.border.subtle }]} />
          <View style={s.metaCol}>
            <Text style={[s.metaLabel, { 
              fontFamily: theme.typography.caption.fontFamily,
              color: theme.colors.text.secondary 
            }]}>COMPATIBLE</Text>
            <Text style={[s.metaValue, { 
              fontFamily: theme.typography.body.fontFamily,
              color: theme.colors.text.primary 
            }]}>O-, O+, A-, B-</Text>
          </View>
        </View>
      </View>
      <View style={[s.mockAction, { 
        backgroundColor: theme.colors.brand.default, 
        borderRadius: theme.radius.md 
      }]}>
        <Text style={[s.mockActionText, { 
          fontFamily: theme.typography.bodyLg.fontFamily,
          color: theme.colors.text.onColor 
        }]}>Swipe to Accept Request</Text>
      </View>
    </View>
  );

  const renderMockup2 = () => (
    <View style={[s.mockCard, { 
      backgroundColor: theme.colors.bg.surface, 
      borderColor: theme.colors.border.subtle, 
      borderRadius: theme.radius.lg,
      borderWidth: theme.dark ? 0 : 1,
      ...theme.shadows.elevation1
    }]}>
      <Text style={[s.mockSectionTitle, { 
        fontFamily: theme.typography.h3.fontFamily,
        color: theme.colors.text.primary 
      }]}>Active Response Queue</Text>
      
      <View style={[s.queueItem, { 
        backgroundColor: theme.colors.bg.subtle, 
        borderColor: theme.colors.border.subtle 
      }]}>
        <View style={[s.avatarCircle, { backgroundColor: theme.colors.border.strong }]}>
          <Text style={[s.avatarText, { color: theme.colors.text.primary }]}>D1</Text>
        </View>
        <View style={s.queueDetails}>
          <Text style={[s.queueName, { 
            fontFamily: theme.typography.body.fontFamily,
            color: theme.colors.text.primary 
          }]}>Donor 1 (Matched)</Text>
          <Text style={[s.queueStatus, { 
            fontFamily: theme.typography.bodySm.fontFamily,
            color: theme.colors.text.secondary 
          }]}>ETA: 8 mins • Verified</Text>
        </View>
        <Text style={[s.pointsLabel, { color: theme.colors.status.active }]}>+100 XP</Text>
      </View>

      <View style={[s.queueItem, { 
        backgroundColor: theme.colors.brand.subtle, 
        borderColor: theme.colors.brand.default 
      }]}>
        <View style={[s.avatarCircle, { backgroundColor: theme.colors.brand.default }]}>
          <Text style={[s.avatarText, { color: '#FFF', fontSize: 10 }]}>YOU</Text>
        </View>
        <View style={s.queueDetails}>
          <Text style={[s.queueName, { 
            fontFamily: theme.typography.body.fontFamily,
            color: theme.colors.text.primary 
          }]}>You (O-)</Text>
          <Text style={[s.queueStatus, { 
            fontFamily: theme.typography.bodySm.fontFamily,
            color: theme.colors.text.secondary 
          }]}>Queue position: #2 • 1.4km</Text>
        </View>
        <Text style={[s.pointsLabel, { 
          fontFamily: theme.typography.bodySm.fontFamily,
          color: theme.colors.text.secondary 
        }]}>Pending</Text>
      </View>
    </View>
  );

  const renderMockup3 = () => (
    <View style={[s.mockCard, { 
      backgroundColor: theme.colors.bg.surface, 
      borderColor: theme.colors.border.subtle, 
      borderRadius: theme.radius.lg,
      borderWidth: theme.dark ? 0 : 1,
      ...theme.shadows.elevation1
    }]}>
      <View style={s.mapHeader}>
        <Text style={[s.mockSectionTitle, { 
          fontFamily: theme.typography.h3.fontFamily,
          color: theme.colors.text.primary,
          marginBottom: 2 
        }]}>Directions to Hospital</Text>
        <Text style={[s.mapSubtitle, { 
          fontFamily: theme.typography.bodySm.fontFamily,
          color: theme.colors.text.secondary 
        }]}>Bangladesh General Hospital</Text>
      </View>
      
      <View style={[s.mapMock, { 
        backgroundColor: theme.colors.bg.subtle, 
        borderColor: theme.colors.border.subtle 
      }]}>
        <View style={[s.mapLine, { backgroundColor: theme.colors.border.subtle }]} />
        <View style={[s.mapLine, s.mapLineVertical, { backgroundColor: theme.colors.border.subtle }]} />
        <View style={[s.mapRoute, { backgroundColor: theme.colors.brand.default }]} />
        <View style={s.mapMarkerStart}>
          <Text style={{ fontSize: 14 }}>📍</Text>
        </View>
        <View style={s.mapMarkerEnd}>
          <Text style={{ fontSize: 14 }}>🏥</Text>
        </View>
      </View>
      <View style={s.mapFooter}>
        <Text style={[s.mapFooterText, { 
          fontFamily: theme.typography.body.fontFamily,
          color: theme.colors.text.primary 
        }]}>Arriving in 12 mins (4.2 km)</Text>
      </View>
    </View>
  );

  const renderMockup4 = () => (
    <View style={[s.mockCard, { 
      backgroundColor: theme.colors.bg.surface, 
      borderColor: theme.colors.border.subtle, 
      borderRadius: theme.radius.lg,
      borderWidth: theme.dark ? 0 : 1,
      ...theme.shadows.elevation1,
      alignItems: 'center', 
      justifyContent: 'center', 
      paddingVertical: 20 
    }]}>
      <View style={[s.successCircle, { backgroundColor: theme.colors.brand.subtle }]}>
        <Text style={{ fontSize: 32 }}>❤️</Text>
      </View>
      <Text style={[s.successTitle, { 
        fontFamily: theme.typography.h2.fontFamily,
        color: theme.colors.text.primary 
      }]}>Donation Logged!</Text>
      <Text style={[s.successDesc, { 
        fontFamily: theme.typography.body.fontFamily,
        color: theme.colors.text.secondary 
      }]}>Thank you for saving a life today.</Text>
      
      <View style={[s.pointsCard, { 
        backgroundColor: '#FFFBEB', 
        borderColor: '#FEF3C7',
        borderRadius: theme.radius.md
      }]}>
        <Text style={[s.pointsTitle, { fontFamily: theme.typography.caption.fontFamily }]}>REWARDS EARNED</Text>
        <Text style={[s.pointsValue, { fontFamily: theme.typography.h3.fontFamily }]}>+250 Veno Points</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.colors.bg.page }]}>
      <StatusBar 
        barStyle={theme.dark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.bg.page} 
        translucent={false} 
      />
      
      {/* Skip button */}
      <TouchableOpacity style={s.skipButton} onPress={finishGuide}>
        <Text style={[s.skipText, { 
          fontFamily: theme.typography.caption.fontFamily,
          color: theme.colors.text.secondary 
        }]}>SKIP</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={s.scrollView}
      >
        {slides.map((slide) => (
          <View key={slide.id} style={s.slide}>
            <View style={s.mockupContainer}>
              {slide.id === '1' && renderMockup1()}
              {slide.id === '2' && renderMockup2()}
              {slide.id === '3' && renderMockup3()}
              {slide.id === '4' && renderMockup4()}
            </View>
            <View style={s.textContainer}>
              <View style={[s.iconBadge, { backgroundColor: theme.colors.brand.subtle }]}>{slide.icon}</View>
              <Text style={[s.slideTitle, { 
                fontFamily: theme.typography.h1.fontFamily,
                color: theme.colors.text.primary 
              }]}>{slide.title}</Text>
              <Text style={[s.slideDescription, { 
                fontFamily: theme.typography.body.fontFamily,
                color: theme.colors.text.secondary 
              }]}>{slide.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.pagination}>
          {slides.map((_, index) => (
            <AnimatedDot key={index} active={activeSlide === index} />
          ))}
        </View>

        <TouchableOpacity 
          style={[s.nextButton, { 
            backgroundColor: theme.colors.brand.default, 
            borderRadius: theme.radius.md 
          }]} 
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={[s.nextButtonText, { 
            fontFamily: theme.typography.bodyLg.fontFamily,
            color: theme.colors.text.onColor 
          }]}>
            {activeSlide === slides.length - 1 ? 'START USING VENO' : 'NEXT STEP'}
          </Text>
          <ArrowRight size={16} color={theme.colors.text.onColor} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 64 : 20,
    right: 16,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 12,
    letterSpacing: 1.5,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: width,
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingBottom: 20,
  },
  mockupContainer: {
    width: '100%',
    height: height * 0.36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockCard: {
    width: '100%',
    padding: 20,
  },
  mockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeUrgent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeUrgentText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  mockTime: {
    fontSize: 11,
  },
  mockBody: {
    marginBottom: 16,
  },
  mockTitle: {
    fontSize: 17,
    marginBottom: 4,
  },
  mockDesc: {
    fontSize: 13,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
  },
  metaDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 12,
  },
  mockAction: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockActionText: {
    fontSize: 14,
  },
  mockSectionTitle: {
    fontSize: 15,
    marginBottom: 16,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600',
  },
  queueDetails: {
    flex: 1,
  },
  queueName: {
    fontSize: 13,
  },
  queueStatus: {
    fontSize: 11,
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  mapHeader: {
    marginBottom: 12,
  },
  mapSubtitle: {
    fontSize: 12,
  },
  mapMock: {
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    marginBottom: 12,
  },
  mapLine: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    height: 1.5,
  },
  mapLineVertical: {
    position: 'absolute',
    top: 20,
    bottom: 20,
    left: 140,
    width: 1.5,
  },
  mapRoute: {
    position: 'absolute',
    top: 59,
    left: 40,
    width: 100,
    height: 3,
  },
  mapMarkerStart: {
    position: 'absolute',
    top: 48,
    left: 32,
    zIndex: 2,
  },
  mapMarkerEnd: {
    position: 'absolute',
    top: 48,
    left: 132,
    zIndex: 2,
  },
  mapFooter: {
    alignItems: 'center',
  },
  mapFooterText: {
    fontSize: 12,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    marginBottom: 4,
  },
  successDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  pointsCard: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pointsTitle: {
    fontSize: 10,
    color: '#D97706',
    letterSpacing: 0.8,
  },
  pointsValue: {
    fontSize: 14,
    color: '#B45309',
  },
  textContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  slideTitle: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  slideDescription: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  footer: {
    height: height * 0.18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 24,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  nextButton: {
    height: 52,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
