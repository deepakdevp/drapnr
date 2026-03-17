import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StatusBar,
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const RING_SIZE = 80;
const RING_STROKE = 6;

// ── Prompt cycle ───────────────────────────────────────────────────────────────
const PROMPTS = [
  'Walk slowly around the person',
  'Keep the whole body in frame',
  'Almost there...',
] as const;

const PROMPT_INTERVAL_MS = 4_000;

// ── Component ──────────────────────────────────────────────────────────────────
export default function RecordingScreen(): React.JSX.Element {
  const router = useRouter();

  // Timer
  const [elapsed, setElapsed] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prompt cycling
  const [promptIndex, setPromptIndex] = useState<number>(0);
  const promptOpacity = useRef(new Animated.Value(1)).current;

  // Progress ring (0 → 1)
  const progress = useRef(new Animated.Value(0)).current;

  // Mock rotation value for magnetometer concept
  const rotation = useRef(new Animated.Value(0)).current;

  // ── Start recording on mount ──────────────────────────────────────────────
  useEffect(() => {
    // Timer tick
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1_000);

    // Animate progress ring over 30 seconds
    Animated.timing(progress, {
      toValue: 1,
      duration: 30_000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Mock magnetometer rotation
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 8_000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [progress, rotation]);

  // ── Prompt cycling ────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out → change → fade in
      Animated.timing(promptOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setPromptIndex((prev) => (prev + 1) % PROMPTS.length);
        Animated.timing(promptOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, PROMPT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [promptOpacity]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  const handleStop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    router.push('/(tabs)/capture/review');
  }, [router]);

  // ── Derived animations ────────────────────────────────────────────────────
  const ringRotation = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, RING_SIZE * Math.PI],
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Camera placeholder */}
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.cameraLabel}>Camera Feed</Text>
        <Animated.View
          style={[
            styles.silhouette,
            { transform: [{ rotate: ringRotation }] },
          ]}
        >
          <View style={styles.silhouetteHead} />
          <View style={styles.silhouetteBody} />
        </Animated.View>
      </View>

      {/* Progress ring at top center */}
      <View style={styles.ringContainer}>
        <View style={styles.ringTrack}>
          <Animated.View
            style={[
              styles.ringFill,
              {
                width: progressWidth,
              },
            ]}
          />
        </View>
        <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        {/* Cycling prompt */}
        <Animated.Text style={[styles.promptText, { opacity: promptOpacity }]}>
          {PROMPTS[promptIndex]}
        </Animated.Text>

        {/* Timer large display */}
        <Text style={styles.timerLarge}>{formatTime(elapsed)}</Text>

        {/* Stop button */}
        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStop}
          activeOpacity={0.7}
        >
          <View style={styles.stopButtonInner} />
        </TouchableOpacity>

        <Text style={styles.stopLabel}>Tap to stop</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLabel: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
  },
  silhouette: {
    alignItems: 'center',
    opacity: 0.15,
  },
  silhouetteHead: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6B7280',
  },
  silhouetteBody: {
    width: 80,
    height: 120,
    borderRadius: 40,
    backgroundColor: '#6B7280',
    marginTop: -10,
  },
  ringContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 50,
    alignSelf: 'center',
    alignItems: 'center',
  },
  ringTrack: {
    width: RING_SIZE * Math.PI,
    height: RING_STROKE,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: RING_STROKE / 2,
    overflow: 'hidden',
  },
  ringFill: {
    height: RING_STROKE,
    backgroundColor: COLORS.primary,
    borderRadius: RING_STROKE / 2,
  },
  timerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    letterSpacing: 1,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingTop: 30,
  },
  promptText: {
    color: COLORS.background,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  timerLarge: {
    color: COLORS.background,
    fontSize: 42,
    fontWeight: '200',
    letterSpacing: 4,
    marginBottom: 24,
    fontVariant: ['tabular-nums'],
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stopButtonInner: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  stopLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
