// =============================================================================
// Drapnr — Texture Loading & Caching Utilities
// =============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TextureState {
  texture: THREE.Texture | null;
  isLoading: boolean;
  error: string | null;
}

// -----------------------------------------------------------------------------
// In-memory texture cache (keyed by URL)
// -----------------------------------------------------------------------------

const textureCache = new Map<string, THREE.Texture>();
const pendingLoads = new Map<string, Promise<THREE.Texture>>();

function createFallbackTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

let _fallbackTexture: THREE.Texture | null = null;

export function getFallbackTexture(): THREE.Texture {
  if (!_fallbackTexture) {
    _fallbackTexture = createFallbackTexture();
  }
  return _fallbackTexture;
}

// -----------------------------------------------------------------------------
// Core loader (deduplicates in-flight requests)
// -----------------------------------------------------------------------------

function loadTextureAsync(url: string): Promise<THREE.Texture> {
  const cached = textureCache.get(url);
  if (cached) return Promise.resolve(cached);

  const pending = pendingLoads.get(url);
  if (pending) return pending;

  const loader = new THREE.TextureLoader();
  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.flipY = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        textureCache.set(url, tex);
        pendingLoads.delete(url);
        resolve(tex);
      },
      undefined,
      (err) => {
        pendingLoads.delete(url);
        reject(err);
      },
    );
  });

  pendingLoads.set(url, promise);
  return promise;
}

// -----------------------------------------------------------------------------
// useTexture hook
// -----------------------------------------------------------------------------

export function useTexture(url: string | null): TextureState {
  const [state, setState] = useState<TextureState>({
    texture: null,
    isLoading: false,
    error: null,
  });
  const cancelledRef = useRef(false);
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    cancelledRef.current = false;
    currentUrlRef.current = url;

    if (!url) {
      setState({ texture: null, isLoading: false, error: null });
      return;
    }

    // Return cached immediately if available
    const cached = textureCache.get(url);
    if (cached) {
      setState({ texture: cached, isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    loadTextureAsync(url)
      .then((tex) => {
        if (!cancelledRef.current && currentUrlRef.current === url) {
          setState({ texture: tex, isLoading: false, error: null });
        }
      })
      .catch((err) => {
        if (!cancelledRef.current && currentUrlRef.current === url) {
          const message =
            err instanceof Error ? err.message : 'Failed to load texture';
          setState({
            texture: getFallbackTexture(),
            isLoading: false,
            error: message,
          });
        }
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [url]);

  return state;
}

// -----------------------------------------------------------------------------
// Cache management
// -----------------------------------------------------------------------------

export function disposeTexture(url: string): void {
  const tex = textureCache.get(url);
  if (tex) {
    tex.dispose();
    textureCache.delete(url);
  }
}

export function clearTextureCache(): void {
  textureCache.forEach((tex) => tex.dispose());
  textureCache.clear();
}

export function preloadTextures(urls: string[]): Promise<void> {
  return Promise.all(urls.map(loadTextureAsync)).then(() => undefined);
}

// -----------------------------------------------------------------------------
// TextureSwapper component — applies texture to a material imperatively
// -----------------------------------------------------------------------------

interface TextureSwapperProps {
  url: string | null;
  materialRef: React.RefObject<THREE.MeshStandardMaterial | null>;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: string) => void;
}

export function TextureSwapper({
  url,
  materialRef,
  onLoadStart,
  onLoadEnd,
  onError,
}: TextureSwapperProps): null {
  const { texture, isLoading, error } = useTexture(url);

  useEffect(() => {
    if (isLoading) {
      onLoadStart?.();
    } else {
      onLoadEnd?.();
    }
  }, [isLoading, onLoadStart, onLoadEnd]);

  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  useEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;

    if (texture) {
      mat.map = texture;
      mat.needsUpdate = true;
    } else {
      mat.map = null;
      mat.needsUpdate = true;
    }
  }, [texture, materialRef]);

  return null;
}

export default TextureSwapper;
