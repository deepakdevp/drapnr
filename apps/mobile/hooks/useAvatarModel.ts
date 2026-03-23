// =============================================================================
// Drapnr -- Avatar Model Loading Hook
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Asset } from 'expo-asset';
import { createLogger } from '../utils/logger';

const log = createLogger('useAvatarModel');

// -----------------------------------------------------------------------------
// Model manifest (maps template keys to bundled assets)
// -----------------------------------------------------------------------------

const MODEL_ASSETS: Record<string, ReturnType<typeof require>> = {
  male_slim: require('../assets/models/male_slim.glb'),
  male_avg: require('../assets/models/male_avg.glb'),
  female_slim: require('../assets/models/female_slim.glb'),
  female_avg: require('../assets/models/female_avg.glb'),
};

// In-memory cache of resolved URIs so we only resolve each model once
const resolvedUriCache = new Map<string, string>();

// Set of templates currently being loaded (dedup in-flight requests)
const pendingLoads = new Map<string, Promise<string>>();

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface UseAvatarModelReturn {
  /** Local URI to the resolved GLB asset, or null while loading / on error */
  modelPath: string | null;
  /** True while the asset is being downloaded / resolved */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
}

// -----------------------------------------------------------------------------
// Asset resolution helper
// -----------------------------------------------------------------------------

async function resolveModelAsset(templateKey: string): Promise<string> {
  // Return from cache immediately
  const cached = resolvedUriCache.get(templateKey);
  if (cached) return cached;

  // Dedup concurrent requests for the same template
  const pending = pendingLoads.get(templateKey);
  if (pending) return pending;

  const assetModule = MODEL_ASSETS[templateKey];
  if (!assetModule) {
    throw new Error(`Unknown body template: "${templateKey}". Valid keys: ${Object.keys(MODEL_ASSETS).join(', ')}`);
  }

  const promise = (async () => {
    try {
      const [asset] = await Asset.loadAsync(assetModule);
      const uri = asset.localUri ?? asset.uri;
      if (!uri) {
        throw new Error(`Failed to resolve local URI for model: ${templateKey}`);
      }
      resolvedUriCache.set(templateKey, uri);
      return uri;
    } finally {
      pendingLoads.delete(templateKey);
    }
  })();

  pendingLoads.set(templateKey, promise);
  return promise;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAvatarModel(bodyTemplate: string): UseAvatarModelReturn {
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const currentTemplateRef = useRef(bodyTemplate);

  useEffect(() => {
    cancelledRef.current = false;
    currentTemplateRef.current = bodyTemplate;

    // Fast path: already cached
    const cached = resolvedUriCache.get(bodyTemplate);
    if (cached) {
      setModelPath(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setModelPath(null);

    resolveModelAsset(bodyTemplate)
      .then((uri) => {
        if (!cancelledRef.current && currentTemplateRef.current === bodyTemplate) {
          setModelPath(uri);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelledRef.current && currentTemplateRef.current === bodyTemplate) {
          const message = err instanceof Error ? err.message : 'Failed to load model';
          log.error(message);
          setError(message);
          setIsLoading(false);
        }
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [bodyTemplate]);

  return { modelPath, isLoading, error };
}

// -----------------------------------------------------------------------------
// Preload utility (call early, e.g. on app startup)
// -----------------------------------------------------------------------------

export async function preloadAvatarModels(templates?: string[]): Promise<void> {
  const keys = templates ?? Object.keys(MODEL_ASSETS);
  await Promise.all(keys.map((key) => resolveModelAsset(key).catch(() => {})));
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function getAvailableTemplates(): string[] {
  return Object.keys(MODEL_ASSETS);
}

export default useAvatarModel;
