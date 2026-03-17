// =============================================================================
// Recording Screen — Real 360-degree video capture
// =============================================================================
// Uses VisionCamera for live preview and frame capture, magnetometer for
// rotation tracking, and captures frames at ~12-degree intervals.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import Svg, { Circle } from 'react-native-svg';

import { useRotationTracking } from '../../../hooks/useRotationTracking';
import { useFrameCapture } from '../../../hooks/useFrameCapture';
import { useCaptureStore } from '../../../stores/captureStore';

// ── Design tokens ────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#FF6B6B',
  background: '#FFFFFF',
  text: '#1A1A2E',
  secondaryText: '#6B7280',
  surface: '#F8F9FA',
  warning: '#F59E0B',
  error: '#EF4444',
} as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Progress ring dimensions ─────────────────────────────────────────────────
const RING_SIZE = 100;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ── Capture settings ─────────────────────────────────────────────────────────
const CAPTURE_INTERVAL_DEG = 12; // Capture a frame every 12 degrees (~30 frames)
const AUTO_STOP_DEG = 340; // Auto-stop threshold

// ── Prompt cycle ─────────────────────────────────────────────────────────────
const PROMPTS = [
  'Walk slowly around the person',
  'Keep the whole body in frame',
  'Maintain a steady pace',
  'Almost there...',
] as const;

const PROMPT_INTERVAL_MS = 4_000;

// ── AnimatedCircle for SVG ───────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Component ────────────────────────────────────────────────────────────────
export default function RecordingScreen(): React.JSX.Element {
  const router = useRouter();
  const cameraRef = useRef<Camera>(null);

  // Camera device and permissions
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  // Stores
  const addFrame = useCaptureStore((s) => s.addFrame);
  const stopRecording = useCaptureStore((s) => s.stopRecording);
  const startRecording = useCaptureStore((s) => s.startRecording);
  const updateRotation = useCaptureStore((s) => s.updateRotation);

  // Custom hooks
  const rotationTracker = useRotationTracking();
  const { frames, captureFrame, clearFrames } = useFrameCapture(cameraRef);

  // Local state
  const [elapsed, setElapsed] = useState<number>(0);
  const [promptIndex, setPromptIndex] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  // Animations
  const promptOpacity = useRef(new Animated.Value(1)).current;
  const tiltPulse = useRef(new Animated.Value(1)).current;

  // Refs for interval tracking
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCaptureRotationRef = useRef<number>(0);
  const hasAutoStoppedRef = useRef<boolean>(false);

  // ── Request permission on mount ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          setPermissionDenied(true);
        }
      }
    })();
  }, [hasPermission, requestPermission]);

  // ── Start recording once permission is granted ─────────────────────────────
  useEffect(() => {
    if (hasPermission && device && !isRecording && !permissionDenied) {
      // Small delay to let camera initialize
      const timeout = setTimeout(() => {
        setIsRecording(true);
        startRecording();
        rotationTracker.start();

        // Start elapsed timer
        timerRef.current = setInterval(() => {
          setElapsed((prev) => prev + 1);
        }, 1_000);
      }, 500);

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [hasPermission, device, permissionDenied]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Frame capture based on rotation ────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) return;

    const currentRotation = rotationTracker.rotation;
    const lastCapture = lastCaptureRotationRef.current;

    if (currentRotation - lastCapture >= CAPTURE_INTERVAL_DEG) {
      lastCaptureRotationRef.current =
        Math.floor(currentRotation / CAPTURE_INTERVAL_DEG) * CAPTURE_INTERVAL_DEG;

      captureFrame().then((uri) => {
        if (uri) {
          addFrame(uri);
        }
      });
    }
  }, [rotationTracker.rotation, isRecording, captureFrame, addFrame]);

  // ── Update store rotation ──────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      updateRotation(rotationTracker.rotation);
    }
  }, [rotationTracker.rotation, isRecording, updateRotation]);

  // ── Auto-stop when rotation complete ───────────────────────────────────────
  useEffect(() => {
    if (rotationTracker.isComplete && isRecording && !hasAutoStoppedRef.current) {
      hasAutoStoppedRef.current = true;
      handleStop();
    }
  }, [rotationTracker.isComplete, isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tilt warning pulse animation ──────────────────────────────────────────
  useEffect(() => {
    if (rotationTracker.tiltWarning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(tiltPulse, {
            toValue: 1.1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(tiltPulse, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      tiltPulse.stopAnimation();
      tiltPulse.setValue(1);
    }
  }, [rotationTracker.tiltWarning, tiltPulse]);

  // ── Prompt cycling ─────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  const handleStop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    rotationTracker.stop();
    stopRecording();
    router.push('/(tabs)/capture/review');
  }, [router, rotationTracker, stopRecording]);

  const handleRetryPermission = useCallback(async () => {
    const granted = await requestPermission();
    if (granted) {
      setPermissionDenied(false);
    }
  }, [requestPermission]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Progress ring calculation ──────────────────────────────────────────────
  const progressFraction = Math.min(rotationTracker.rotation / 360, 1);
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progressFraction);

  // ── Permission denied UI ───────────────────────────────────────────────────
  if (permissionDenied || (!hasPermission && !device)) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionMessage}>
          Drapnr needs camera access to capture your outfit from all angles.
          Please grant camera permission to continue.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={handleRetryPermission}
          activeOpacity={0.7}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.permissionBackButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.permissionBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── No device fallback ─────────────────────────────────────────────────────
  if (!device) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.permissionTitle}>No Camera Found</Text>
        <Text style={styles.permissionMessage}>
          Could not find a back camera on this device.
        </Text>
        <TouchableOpacity
          style={styles.permissionBackButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.permissionBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main recording UI ─────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Live camera preview */}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isRecording || !permissionDenied}
        photo={true}
        enableZoomGesture={false}
      />

      {/* Progress ring at top center */}
      <View style={styles.ringContainer}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          {/* Track */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={RING_STROKE}
            fill="none"
          />
          {/* Progress fill */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={COLORS.primary}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${RING_CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={styles.ringDegrees}>
            {Math.round(rotationTracker.rotation)}°
          </Text>
        </View>
        <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
      </View>

      {/* Frame count indicator */}
      <View style={styles.frameCountContainer}>
        <Text style={styles.frameCountText}>
          {frames.length} frames
        </Text>
      </View>

      {/* Tilt warning */}
      {rotationTracker.tiltWarning && (
        <Animated.View
          style={[
            styles.tiltWarning,
            { transform: [{ scale: tiltPulse }] },
          ]}
        >
          <Text style={styles.tiltWarningText}>
            Hold your phone more upright
          </Text>
        </Animated.View>
      )}

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

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // -- Permission denied UI --
  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 15,
    color: COLORS.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionButton: {
    height: 52,
    paddingHorizontal: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.background,
  },
  permissionBackButton: {
    height: 44,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBackText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.secondaryText,
  },

  // -- Progress ring --
  ringContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 50,
    alignSelf: 'center',
    alignItems: 'center',
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringDegrees: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  timerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    letterSpacing: 1,
  },

  // -- Frame count --
  frameCountContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  frameCountText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '600',
  },

  // -- Tilt warning --
  tiltWarning: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 180 : 160,
    alignSelf: 'center',
    backgroundColor: COLORS.warning,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tiltWarningText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // -- Bottom controls --
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
