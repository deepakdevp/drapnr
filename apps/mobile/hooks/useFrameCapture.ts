// =============================================================================
// useFrameCapture — Interval-based frame capture from VisionCamera
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import type { Camera } from 'react-native-vision-camera';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseFrameCaptureReturn {
  /** Array of captured frame file URIs. */
  frames: string[];
  /** Capture a single frame from the camera. Returns the URI or null on failure. */
  captureFrame: () => Promise<string | null>;
  /** Delete all captured frames from disk and clear the array. */
  clearFrames: () => Promise<void>;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FRAMES_DIR = `${FileSystem.cacheDirectory}drapnr-frames/`;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useFrameCapture(
  cameraRef: React.RefObject<Camera | null>,
): UseFrameCaptureReturn {
  const [frames, setFrames] = useState<string[]>([]);
  const frameCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Ensure frames directory exists on mount
  useEffect(() => {
    isMountedRef.current = true;

    (async () => {
      try {
        const dirInfo = await FileSystem.getInfoAsync(FRAMES_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(FRAMES_DIR, { intermediates: true });
        }
      } catch {
        // Directory creation failed, will retry on capture
      }
    })();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const captureFrame = useCallback(async (): Promise<string | null> => {
    const camera = cameraRef.current;
    if (!camera) return null;

    try {
      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(FRAMES_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(FRAMES_DIR, { intermediates: true });
      }

      // Take photo using VisionCamera
      const photo = await camera.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off',
        enableShutterSound: false,
      });

      // Move photo to our frames directory with sequential naming
      const frameIndex = frameCountRef.current;
      const destPath = `${FRAMES_DIR}frame_${String(frameIndex).padStart(4, '0')}.jpg`;

      // VisionCamera returns a path; copy to our managed directory
      const sourcePath = photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`;

      await FileSystem.copyAsync({
        from: sourcePath,
        to: destPath,
      });

      frameCountRef.current += 1;

      if (isMountedRef.current) {
        setFrames((prev) => [...prev, destPath]);
      }

      return destPath;
    } catch (error) {
      console.warn('[useFrameCapture] Failed to capture frame:', error);
      return null;
    }
  }, [cameraRef]);

  const clearFrames = useCallback(async (): Promise<void> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(FRAMES_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(FRAMES_DIR, { idempotent: true });
        await FileSystem.makeDirectoryAsync(FRAMES_DIR, { intermediates: true });
      }
    } catch {
      // Best-effort cleanup
    }

    frameCountRef.current = 0;

    if (isMountedRef.current) {
      setFrames([]);
    }
  }, []);

  // Cleanup captured frames on unmount
  useEffect(() => {
    return () => {
      // Don't delete frames on unmount — they may be needed by the review screen.
      // Cleanup happens explicitly via clearFrames().
    };
  }, []);

  return {
    frames,
    captureFrame,
    clearFrames,
  };
}
