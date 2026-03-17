import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

// ── Design tokens ──────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#FF6B6B',
  background: '#FFFFFF',
  text: '#1A1A2E',
  secondaryText: '#6B7280',
  surface: '#F8F9FA',
} as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Processing steps ───────────────────────────────────────────────────────────
interface ProcessingStep {
  label: string;
  duration: number; // ms
}

const STEPS: ProcessingStep[] = [
  { label: 'Uploading frames...', duration: 3_000 },
  { label: 'Analyzing outfit...', duration: 4_000 },
  { label: 'Extracting garments...', duration: 5_000 },
  { label: 'Creating textures...', duration: 4_000 },
  { label: 'Almost done!', duration: 2_000 },
];

const TOTAL_DURATION = STEPS.reduce((sum, s) => sum + s.duration, 0);

export default function ProcessingScreen(): React.JSX.Element {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [percentage, setPercentage] = useState<number>(0);

  // Animated spinner
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Entrance fade ─────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // ── Spinner ───────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1_500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [spinAnim, pulseAnim]);

  // ── Step progression (mock) ───────────────────────────────────────────────
  useEffect(() => {
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 200;
      const pct = Math.min(Math.round((elapsed / TOTAL_DURATION) * 100), 100);
      setPercentage(pct);

      // Determine current step
      let accumulated = 0;
      for (let i = 0; i < STEPS.length; i++) {
        accumulated += STEPS[i].duration;
        if (elapsed < accumulated) {
          setCurrentStep(i);
          break;
        }
        if (i === STEPS.length - 1) {
          setCurrentStep(STEPS.length - 1);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleBrowseWardrobe = () => {
    router.replace('/(tabs)/wardrobe' as never);
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Spinner / Lottie-style indicator */}
      <View style={styles.spinnerArea}>
        <Animated.View
          style={[
            styles.spinnerOuter,
            {
              transform: [{ rotate: spin }, { scale: pulseAnim }],
            },
          ]}
        >
          <View style={styles.spinnerArc} />
        </Animated.View>

        <Text style={styles.percentageText}>{percentage}%</Text>
      </View>

      {/* Step indicators */}
      <View style={styles.stepsContainer}>
        {STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isDone = index < currentStep;
          return (
            <View key={step.label} style={styles.stepRow}>
              <View
                style={[
                  styles.stepDot,
                  isDone && styles.stepDotDone,
                  isActive && styles.stepDotActive,
                ]}
              />
              <Text
                style={[
                  styles.stepLabel,
                  isDone && styles.stepLabelDone,
                  isActive && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
      </View>

      {/* Notification message */}
      <Text style={styles.notificationText}>
        You'll get a notification when it's ready
      </Text>

      {/* Browse Wardrobe button */}
      <TouchableOpacity
        style={styles.browseButton}
        onPress={handleBrowseWardrobe}
        activeOpacity={0.7}
      >
        <Text style={styles.browseButtonText}>Browse Wardrobe</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  spinnerArea: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  spinnerOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: COLORS.surface,
    position: 'absolute',
  },
  spinnerArc: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: COLORS.primary,
  },
  percentageText: {
    fontSize: 28,
    fontWeight: '300',
    color: COLORS.text,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  stepsContainer: {
    alignSelf: 'stretch',
    marginBottom: 32,
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  stepDotDone: {
    backgroundColor: '#10B981',
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepLabel: {
    fontSize: 15,
    color: '#D1D5DB',
    fontWeight: '400',
  },
  stepLabelDone: {
    color: COLORS.secondaryText,
    textDecorationLine: 'line-through',
  },
  stepLabelActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 24,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  notificationText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  browseButton: {
    height: 52,
    paddingHorizontal: 40,
    borderRadius: 12,
    backgroundColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.background,
    letterSpacing: 0.3,
  },
});
