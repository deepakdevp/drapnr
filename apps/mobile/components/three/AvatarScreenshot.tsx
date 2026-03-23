// =============================================================================
// Drapnr — 3D Scene Screenshot Capture
// =============================================================================

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
} from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import type { ExpoWebGLRenderingContext } from 'expo-gl';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AvatarScreenshotHandle {
  /** Capture current GL frame as a base64-encoded PNG string */
  captureAsync: () => Promise<string | null>;
}

export interface AvatarScreenshotProps {
  children: React.ReactNode;
  /** Width of the capture (default 512) */
  captureWidth?: number;
  /** Height of the capture (default 512) */
  captureHeight?: number;
}

// -----------------------------------------------------------------------------
// GL capture helper
// -----------------------------------------------------------------------------

async function captureGLContext(
  gl: ExpoWebGLRenderingContext,
  width: number,
  height: number,
): Promise<string> {
  // expo-gl provides takeSnapshotAsync on the context
  if ('takeSnapshotAsync' in gl && typeof gl.takeSnapshotAsync === 'function') {
    const snapshot = await gl.takeSnapshotAsync({
      format: 'png' as const,
      result: 'base64' as const,
      width,
      height,
    });
    return snapshot.uri as string;
  }

  // Fallback: readPixels approach
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.endFrameEXP();

  // Convert RGBA pixel buffer to base64 (simplified — production would use
  // a canvas or native module for proper PNG encoding)
  return pixelsToBase64(pixels, width, height);
}

function pixelsToBase64(
  pixels: Uint8Array,
  width: number,
  height: number,
): string {
  // On React Native we don't have DOM canvas, so we build a minimal
  // base64 representation. For production, use expo-image-manipulator
  // or a native module for proper PNG encoding.
  //
  // This is a simplified placeholder that returns raw RGBA as base64.
  // The real implementation should use expo-gl's takeSnapshotAsync above.
  if (Platform.OS === 'web') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = ctx.createImageData(width, height);
      // Flip vertically (GL has origin at bottom-left)
      for (let y = 0; y < height; y++) {
        const srcRow = (height - y - 1) * width * 4;
        const dstRow = y * width * 4;
        for (let x = 0; x < width * 4; x++) {
          imageData.data[dstRow + x] = pixels[srcRow + x];
        }
      }
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    }
  }

  // Native fallback — return empty; caller should use takeSnapshotAsync path
  return '';
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const AvatarScreenshot = forwardRef<
  AvatarScreenshotHandle,
  AvatarScreenshotProps
>(function AvatarScreenshot(
  { children, captureWidth = 512, captureHeight = 512 },
  ref,
) {
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);

  const captureAsync = useCallback(async (): Promise<string | null> => {
    const gl = glRef.current;
    if (!gl) {
      // No GL context available for capture
      return null;
    }

    try {
      const result = await captureGLContext(gl, captureWidth, captureHeight);
      return result || null;
    } catch (error) {
      // Capture failed — return null
      return null;
    }
  }, [captureWidth, captureHeight]);

  useImperativeHandle(ref, () => ({ captureAsync }), [captureAsync]);

  return (
    <View style={styles.container}>
      {/* The Canvas child should call onCreated to pass GL context */}
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            onCreated: (state: { gl: ExpoWebGLRenderingContext }) => {
              glRef.current = state.gl;
              // Forward original onCreated if present
              const originalProps = child.props as Record<string, unknown>;
              if (typeof originalProps.onCreated === 'function') {
                (originalProps.onCreated as Function)(state);
              }
            },
          });
        }
        return child;
      })}
    </View>
  );
});

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AvatarScreenshot;
