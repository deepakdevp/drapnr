// =============================================================================
// useRotationTracking — Magnetometer-based 360-degree rotation tracker
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Magnetometer } from 'expo-sensors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RotationState {
  /** Cumulative rotation in degrees (0-360) since recording started. */
  rotation: number;
  /** True when cumulative rotation >= 340 degrees. */
  isComplete: boolean;
  /** True when device tilt exceeds 45 degrees from vertical. */
  tiltWarning: boolean;
  /** Current compass heading in degrees (0-360). */
  heading: number;
  /** Whether tracking is active. */
  isTracking: boolean;
}

interface RotationActions {
  start: () => void;
  stop: () => void;
  reset: () => void;
}

type UseRotationTrackingReturn = RotationState & RotationActions;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const UPDATE_INTERVAL_MS = 100;
const COMPLETION_THRESHOLD_DEG = 340;
const TILT_WARNING_THRESHOLD_DEG = 45;
const LOW_PASS_ALPHA = 0.2; // Smoothing factor (lower = smoother, higher = more responsive)

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Calculate compass heading from magnetometer x, y values.
 * Returns heading in degrees [0, 360).
 */
function calculateHeading(x: number, y: number): number {
  let heading = Math.atan2(y, x) * (180 / Math.PI);
  // Normalize to [0, 360)
  heading = ((heading % 360) + 360) % 360;
  return heading;
}

/**
 * Calculate tilt angle from magnetometer z relative to x,y plane.
 * When the device is held vertically, z should be small relative to x,y.
 * Returns tilt angle in degrees from the vertical plane.
 */
function calculateTiltAngle(x: number, y: number, z: number): number {
  const horizontalMagnitude = Math.sqrt(x * x + y * y);
  if (horizontalMagnitude === 0 && z === 0) return 0;
  const tilt = Math.atan2(Math.abs(z), horizontalMagnitude) * (180 / Math.PI);
  return tilt;
}

/**
 * Calculate the shortest angular distance between two headings.
 * Returns a signed value: positive = clockwise, negative = counter-clockwise.
 */
function angularDelta(from: number, to: number): number {
  let delta = to - from;
  // Normalize to [-180, 180]
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

/**
 * Low-pass filter for smoothing noisy magnetometer readings.
 */
function lowPass(prev: number, next: number, alpha: number): number {
  return prev + alpha * (next - prev);
}

/**
 * Low-pass filter that handles angular wraparound (0/360 boundary).
 */
function lowPassAngle(prev: number, next: number, alpha: number): number {
  const delta = angularDelta(prev, next);
  let result = prev + alpha * delta;
  return ((result % 360) + 360) % 360;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useRotationTracking(): UseRotationTrackingReturn {
  const [state, setState] = useState<RotationState>({
    rotation: 0,
    isComplete: false,
    tiltWarning: false,
    heading: 0,
    isTracking: false,
  });

  const isTrackingRef = useRef(false);
  const initialHeadingRef = useRef<number | null>(null);
  const prevHeadingRef = useRef<number>(0);
  const cumulativeRotationRef = useRef<number>(0);
  const smoothedHeadingRef = useRef<number>(0);
  const subscriptionRef = useRef<ReturnType<typeof Magnetometer.addListener> | null>(null);

  const start = useCallback(() => {
    isTrackingRef.current = true;
    initialHeadingRef.current = null;
    cumulativeRotationRef.current = 0;

    setState((prev) => ({
      ...prev,
      rotation: 0,
      isComplete: false,
      isTracking: true,
    }));

    Magnetometer.setUpdateInterval(UPDATE_INTERVAL_MS);

    subscriptionRef.current = Magnetometer.addListener((data) => {
      if (!isTrackingRef.current) return;

      const rawHeading = calculateHeading(data.x, data.y);
      const tiltAngle = calculateTiltAngle(data.x, data.y, data.z);
      const tiltWarning = tiltAngle > TILT_WARNING_THRESHOLD_DEG;

      // Apply low-pass filter for smoothing
      const smoothedHeading = initialHeadingRef.current === null
        ? rawHeading
        : lowPassAngle(smoothedHeadingRef.current, rawHeading, LOW_PASS_ALPHA);

      smoothedHeadingRef.current = smoothedHeading;

      // Set initial heading on first reading
      if (initialHeadingRef.current === null) {
        initialHeadingRef.current = smoothedHeading;
        prevHeadingRef.current = smoothedHeading;
        setState((prev) => ({
          ...prev,
          heading: smoothedHeading,
          tiltWarning,
        }));
        return;
      }

      // Calculate incremental rotation since last reading
      const delta = angularDelta(prevHeadingRef.current, smoothedHeading);
      cumulativeRotationRef.current += Math.abs(delta);
      prevHeadingRef.current = smoothedHeading;

      // Clamp cumulative rotation to 360
      const rotation = Math.min(cumulativeRotationRef.current, 360);
      const isComplete = rotation >= COMPLETION_THRESHOLD_DEG;

      setState({
        rotation,
        isComplete,
        tiltWarning,
        heading: smoothedHeading,
        isTracking: true,
      });
    });
  }, []);

  const stop = useCallback(() => {
    isTrackingRef.current = false;
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  const reset = useCallback(() => {
    stop();
    initialHeadingRef.current = null;
    cumulativeRotationRef.current = 0;
    smoothedHeadingRef.current = 0;
    setState({
      rotation: 0,
      isComplete: false,
      tiltWarning: false,
      heading: 0,
      isTracking: false,
    });
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      isTrackingRef.current = false;
    };
  }, []);

  return {
    ...state,
    start,
    stop,
    reset,
  };
}
