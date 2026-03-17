// =============================================================================
// Onboarding Screen
// =============================================================================
// 3 horizontal swipe slides with dot indicators, skip, and get started.
// =============================================================================

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: string;
  icon: string;
  title: string;
  description: string;
  gradientStart: string;
  gradientEnd: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    icon: '📷',
    title: 'Capture Your Style',
    description:
      'Stand still while someone films a quick 360-degree video of you. Our AI captures every detail of your outfit in seconds.',
    gradientStart: '#FF2D55',
    gradientEnd: '#FF6F8A',
  },
  {
    id: '2',
    icon: '👗',
    title: 'Your Digital Wardrobe',
    description:
      'Every outfit is automatically catalogued — tops, bottoms, shoes. Browse, search, and organize your entire closet digitally.',
    gradientStart: '#FF8C42',
    gradientEnd: '#FFAD73',
  },
  {
    id: '3',
    icon: '✨',
    title: 'Mix & Match',
    description:
      'Try new combinations on your 3D avatar before you dress. See how pieces work together without opening your closet.',
    gradientStart: '#1A1A2E',
    gradientEnd: '#2D2D44',
  },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const flatListRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const c = theme.colors;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleSkip = () => {
    router.replace('/(auth)/body-template');
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      router.replace('/(auth)/body-template');
    }
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      {/* Illustration placeholder */}
      <View style={[styles.illustrationContainer]}>
        <View
          style={[
            styles.illustrationCircle,
            { backgroundColor: item.gradientStart + '15' },
          ]}
        >
          <View
            style={[
              styles.illustrationInner,
              { backgroundColor: item.gradientStart + '25' },
            ]}
          >
            <Text style={styles.illustrationIcon}>{item.icon}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.slideTitle, { color: c.text.primary }]}>{item.title}</Text>
      <Text style={[styles.slideDescription, { color: c.text.secondary }]}>
        {item.description}
      </Text>
    </View>
  );

  const isLastSlide = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.surface.background }]}>
      {/* Skip */}
      <Animated.View entering={FadeIn.delay(300).duration(400)} style={styles.header}>
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: c.text.secondary }]}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Bottom controls */}
      <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.bottomControls}>
        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === activeIndex ? c.brand.primary : c.neutral.gray300,
                  width: index === activeIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Action button */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: c.brand.primary }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionButtonText, { color: c.text.onPrimary }]}>
            {isLastSlide ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  illustrationContainer: {
    marginBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationIcon: {
    fontSize: 64,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 12,
  },
  slideDescription: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  bottomControls: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actionButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
