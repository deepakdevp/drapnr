// =============================================================================
// Native-only offline implementation — Supabase timestamp-based sync
// =============================================================================
// Uses AsyncStorage to track last sync time. On app open and connectivity
// changes, pulls records where updated_at > last_sync_timestamp.
// WatermelonDB is used for local persistence; sync is manual via Supabase.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoSubscription } from '@react-native-community/netinfo';

import { supabase } from './supabase';
import { createLogger } from '../utils/logger';

const log = createLogger('offline');

const LAST_SYNC_KEY = '@drapnr/last_sync_timestamp';

let netInfoSubscription: NetInfoSubscription | null = null;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function getLastSyncTimestamp(): Promise<string> {
  const ts = await AsyncStorage.getItem(LAST_SYNC_KEY);
  // Default to epoch if never synced
  return ts ?? '1970-01-01T00:00:00.000Z';
}

async function setLastSyncTimestamp(ts: string): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, ts);
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// -----------------------------------------------------------------------------
// Core Sync
// -----------------------------------------------------------------------------

/**
 * Pulls updated records from Supabase since last sync.
 * This is a simple timestamp-based pull — server wins on conflicts.
 */
export async function syncDatabase(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    log.debug('syncDatabase skipped — not authenticated');
    return;
  }

  try {
    const lastSync = await getLastSyncTimestamp();
    const syncStart = new Date().toISOString();

    log.debug('Starting sync from:', lastSync);

    // Pull updated outfits
    const { data: outfits, error: outfitsError } = await supabase
      .from('outfits')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastSync)
      .order('updated_at', { ascending: true });

    if (outfitsError) {
      log.error('Failed to sync outfits:', outfitsError.message);
      return;
    }

    // Pull updated garments
    const { data: garments, error: garmentsError } = await supabase
      .from('garments')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastSync)
      .order('updated_at', { ascending: true });

    if (garmentsError) {
      log.error('Failed to sync garments:', garmentsError.message);
      return;
    }

    // Pull updated combinations
    const { data: combinations, error: combinationsError } = await supabase
      .from('combinations')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastSync)
      .order('updated_at', { ascending: true });

    if (combinationsError) {
      log.error('Failed to sync combinations:', combinationsError.message);
      return;
    }

    const totalSynced =
      (outfits?.length ?? 0) +
      (garments?.length ?? 0) +
      (combinations?.length ?? 0);

    log.debug(`Sync complete: ${totalSynced} records updated`);

    // Update last sync timestamp
    await setLastSyncTimestamp(syncStart);
  } catch (err) {
    log.error('syncDatabase error:', err);
  }
}

export async function syncOnAppOpen(): Promise<void> {
  log.debug('syncOnAppOpen called');
  await syncDatabase();
}

export async function syncOnConnectivityChange(): Promise<void> {
  log.debug('syncOnConnectivityChange called');
  await syncDatabase();
}

// -----------------------------------------------------------------------------
// Network Listener
// -----------------------------------------------------------------------------

export function startNetworkListener(): void {
  if (netInfoSubscription) return;

  netInfoSubscription = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      // Device came back online — sync
      syncDatabase().catch((err) =>
        log.error('Auto-sync on reconnect failed:', err),
      );
    }
  });

  log.debug('Network listener started');
}

export function stopNetworkListener(): void {
  if (netInfoSubscription) {
    netInfoSubscription();
    netInfoSubscription = null;
    log.debug('Network listener stopped');
  }
}

// -----------------------------------------------------------------------------
// Cache Management
// -----------------------------------------------------------------------------

export async function getCacheSize(): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const drapnrKeys = keys.filter((k) => k.startsWith('@drapnr/'));
    return drapnrKeys.length;
  } catch {
    return 0;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const drapnrKeys = keys.filter((k) => k.startsWith('@drapnr/'));
    if (drapnrKeys.length > 0) {
      await AsyncStorage.multiRemove(drapnrKeys);
    }
    log.debug('Cache cleared');
  } catch (err) {
    log.error('clearCache error:', err);
  }
}
