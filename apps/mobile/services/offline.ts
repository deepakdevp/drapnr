// =============================================================================
// Offline / Sync Service
// =============================================================================
// Provides offline caching and sync with Supabase.
// WatermelonDB is only available in native builds — on web/Expo Go, all
// functions are no-ops that return gracefully.
// =============================================================================

import { Platform } from 'react-native';

const IS_NATIVE = Platform.OS !== 'web';

// Re-export a minimal API that works everywhere.
// The real WatermelonDB implementation is loaded dynamically only in native builds.

export async function syncDatabase(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const mod = await import('./offline.native');
    await mod.syncDatabase();
  } catch (err) {
    console.warn('[offline] Sync unavailable:', err);
  }
}

export async function syncOnAppOpen(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const mod = await import('./offline.native');
    await mod.syncOnAppOpen();
  } catch (err) {
    console.warn('[offline] syncOnAppOpen unavailable:', err);
  }
}

export async function syncOnConnectivityChange(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const mod = await import('./offline.native');
    await mod.syncOnConnectivityChange();
  } catch (err) {
    console.warn('[offline] syncOnConnectivityChange unavailable:', err);
  }
}

export async function startNetworkListener(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const mod = await import('./offline.native');
    mod.startNetworkListener();
  } catch (err) {
    console.warn('[offline] startNetworkListener unavailable:', err);
  }
}

export function stopNetworkListener(): void {
  // No-op on web
}

export async function getCacheSize(): Promise<number> {
  if (!IS_NATIVE) return 0;
  try {
    const mod = await import('./offline.native');
    return await mod.getCacheSize();
  } catch {
    return 0;
  }
}

export async function clearCache(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const mod = await import('./offline.native');
    await mod.clearCache();
  } catch (err) {
    console.warn('[offline] clearCache unavailable:', err);
  }
}
