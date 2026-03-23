// =============================================================================
// Offline / Sync Service
// =============================================================================
// Provides offline caching and sync with Supabase.
// WatermelonDB is only available in native builds — on web/Expo Go, all
// functions are no-ops that return gracefully.
// =============================================================================

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';

const log = createLogger('offline');

const IS_NATIVE = Platform.OS !== 'web';

// Re-export a minimal API that works everywhere.
// The real WatermelonDB implementation is loaded dynamically only in native builds.

export async function syncDatabase(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const mod = await import('./offline.native');
    await mod.syncDatabase();
  } catch (err) {
    log.warn('Sync unavailable:', err);
  }
}

export async function syncOnAppOpen(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const mod = await import('./offline.native');
    await mod.syncOnAppOpen();
  } catch (err) {
    log.warn('syncOnAppOpen unavailable:', err);
  }
}

export async function syncOnConnectivityChange(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const mod = await import('./offline.native');
    await mod.syncOnConnectivityChange();
  } catch (err) {
    log.warn('syncOnConnectivityChange unavailable:', err);
  }
}

export async function startNetworkListener(): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    const mod = await import('./offline.native');
    mod.startNetworkListener();
  } catch (err) {
    log.warn('startNetworkListener unavailable:', err);
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
    log.warn('clearCache unavailable:', err);
  }
}
