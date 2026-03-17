// =============================================================================
// Offline / WatermelonDB Service
// =============================================================================
// Local-first database with WatermelonDB, sync with Supabase, and cache
// management. Uses NetInfo for connectivity detection.
// =============================================================================

import { Database, Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly, text } from '@nozbe/watermelondb/decorators';
import { appSchema, tableSchema } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { synchronize } from '@nozbe/watermelondb/sync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

import { supabase } from './supabase';

// -----------------------------------------------------------------------------
// Schema Definition
// -----------------------------------------------------------------------------

export const drapnrSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'outfits',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'thumbnail_url', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'captured_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'garments',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'outfit_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'category', type: 'string' },
        { name: 'texture_url', type: 'string' },
        { name: 'thumbnail_url', type: 'string' },
        { name: 'dominant_color', type: 'string' },
        { name: 'metadata', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'combinations',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'top_id', type: 'string' },
        { name: 'bottom_id', type: 'string' },
        { name: 'shoes_id', type: 'string' },
        { name: 'thumbnail_url', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'processing_jobs',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'outfit_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string' },
        { name: 'progress', type: 'number' },
        { name: 'error_message', type: 'string', isOptional: true },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});

// -----------------------------------------------------------------------------
// Model Classes
// -----------------------------------------------------------------------------

export class OutfitModel extends Model {
  static table = 'outfits';

  @text('server_id') serverId!: string;
  @text('user_id') userId!: string;
  @text('name') name!: string;
  @text('thumbnail_url') thumbnailUrl!: string;
  @text('status') status!: string;
  @field('captured_at') capturedAt!: number;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

export class GarmentModel extends Model {
  static table = 'garments';

  @text('server_id') serverId!: string;
  @text('outfit_id') outfitId!: string;
  @text('user_id') userId!: string;
  @text('category') category!: string;
  @text('texture_url') textureUrl!: string;
  @text('thumbnail_url') thumbnailUrl!: string;
  @text('dominant_color') dominantColor!: string;
  @text('metadata') metadata!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

export class CombinationModel extends Model {
  static table = 'combinations';

  @text('server_id') serverId!: string;
  @text('user_id') userId!: string;
  @text('name') name!: string;
  @text('top_id') topId!: string;
  @text('bottom_id') bottomId!: string;
  @text('shoes_id') shoesId!: string;
  @text('thumbnail_url') thumbnailUrl!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

export class ProcessingJobModel extends Model {
  static table = 'processing_jobs';

  @text('server_id') serverId!: string;
  @text('outfit_id') outfitId!: string;
  @text('user_id') userId!: string;
  @text('status') status!: string;
  @field('progress') progress!: number;
  @text('error_message') errorMessage!: string;
  @field('completed_at') completedAt!: number;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

// -----------------------------------------------------------------------------
// Database Initialization
// -----------------------------------------------------------------------------

const adapter = new SQLiteAdapter({
  schema: drapnrSchema,
  jsi: true,
  onSetUpError: (error) => {
    console.error('[offline] Database setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [OutfitModel, GarmentModel, CombinationModel, ProcessingJobModel],
});

// -----------------------------------------------------------------------------
// Sync Constants
// -----------------------------------------------------------------------------

const LAST_SYNC_KEY = '@drapnr/lastSyncTimestamp';

const TABLE_NAMES = ['outfits', 'garments', 'combinations', 'processing_jobs'] as const;

// -----------------------------------------------------------------------------
// Sync Functions
// -----------------------------------------------------------------------------

/**
 * Pulls remote changes from Supabase for a given table since lastPulledAt.
 * Returns arrays of created, updated, and deleted records.
 */
async function pullChangesForTable(
  tableName: string,
  lastPulledAt: number | null,
): Promise<{
  created: Record<string, unknown>[];
  updated: Record<string, unknown>[];
  deleted: string[];
}> {
  try {
    let query = supabase.from(tableName).select('*');

    if (lastPulledAt) {
      const since = new Date(lastPulledAt).toISOString();
      query = query.gte('updated_at', since);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[offline] Pull error for ${tableName}:`, error.message);
      return { created: [], updated: [], deleted: [] };
    }

    if (!data || data.length === 0) {
      return { created: [], updated: [], deleted: [] };
    }

    // If first sync (no lastPulledAt), all records are "created"
    // Otherwise, we treat them all as "updated" and WatermelonDB handles deduplication
    if (!lastPulledAt) {
      return {
        created: data.map(mapRemoteToLocal),
        updated: [],
        deleted: [],
      };
    }

    return {
      created: [],
      updated: data.map(mapRemoteToLocal),
      deleted: [],
    };
  } catch (err) {
    console.error(`[offline] Pull exception for ${tableName}:`, err);
    return { created: [], updated: [], deleted: [] };
  }
}

/**
 * Maps a Supabase row to the local WatermelonDB column format.
 * The server's `id` becomes `server_id` locally.
 */
function mapRemoteToLocal(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    server_id: row.id,
    // Convert ISO timestamps to epoch ms for WatermelonDB
    created_at: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
    updated_at: row.updated_at ? new Date(row.updated_at as string).getTime() : Date.now(),
    captured_at: row.captured_at ? new Date(row.captured_at as string).getTime() : undefined,
    completed_at: row.completed_at ? new Date(row.completed_at as string).getTime() : undefined,
    // Stringify metadata if it's an object
    metadata: row.metadata && typeof row.metadata === 'object'
      ? JSON.stringify(row.metadata)
      : row.metadata,
  };
}

/**
 * Pushes locally modified records to Supabase.
 * Uses upsert with server_id for conflict resolution (server wins on conflict).
 */
async function pushChangesForTable(
  tableName: string,
  changes: {
    created: Record<string, unknown>[];
    updated: Record<string, unknown>[];
    deleted: string[];
  },
): Promise<void> {
  try {
    // Push created records
    for (const record of changes.created) {
      const remoteRecord = mapLocalToRemote(record);
      const { error } = await supabase.from(tableName).insert(remoteRecord);
      if (error) {
        console.error(`[offline] Push create error for ${tableName}:`, error.message);
      }
    }

    // Push updated records
    for (const record of changes.updated) {
      const serverId = record.server_id as string;
      if (!serverId) continue;

      const remoteRecord = mapLocalToRemote(record);
      const { error } = await supabase.from(tableName).update(remoteRecord).eq('id', serverId);
      if (error) {
        console.error(`[offline] Push update error for ${tableName}:`, error.message);
      }
    }

    // Push deletions
    for (const id of changes.deleted) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) {
        console.error(`[offline] Push delete error for ${tableName}:`, error.message);
      }
    }
  } catch (err) {
    console.error(`[offline] Push exception for ${tableName}:`, err);
  }
}

/**
 * Maps a local WatermelonDB record to Supabase column format.
 */
function mapLocalToRemote(record: Record<string, unknown>): Record<string, unknown> {
  const remote: Record<string, unknown> = { ...record };

  // Map server_id back to id
  if (remote.server_id) {
    remote.id = remote.server_id;
  }
  delete remote.server_id;

  // Convert epoch timestamps back to ISO strings
  if (typeof remote.created_at === 'number') {
    remote.created_at = new Date(remote.created_at).toISOString();
  }
  if (typeof remote.updated_at === 'number') {
    remote.updated_at = new Date(remote.updated_at).toISOString();
  }
  if (typeof remote.captured_at === 'number') {
    remote.captured_at = new Date(remote.captured_at).toISOString();
  }
  if (typeof remote.completed_at === 'number') {
    remote.completed_at = new Date(remote.completed_at).toISOString();
  }

  // Parse metadata back to object
  if (typeof remote.metadata === 'string') {
    try {
      remote.metadata = JSON.parse(remote.metadata as string);
    } catch {
      // Keep as string if parse fails
    }
  }

  // Remove WatermelonDB internal fields
  delete remote._status;
  delete remote._changed;

  return remote;
}

/**
 * Main sync function. Pulls from Supabase, applies to local DB,
 * then pushes local changes to Supabase.
 * Conflict resolution: server wins (last-write-wins).
 */
export async function syncDatabase(): Promise<void> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    console.log('[offline] No network connection, skipping sync');
    return;
  }

  try {
    const lastSyncStr = await AsyncStorage.getItem(LAST_SYNC_KEY);
    const lastPulledAt = lastSyncStr ? parseInt(lastSyncStr, 10) : null;
    const syncStartedAt = Date.now();

    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt: wmLastPulledAt }) => {
        const timestamp = wmLastPulledAt ?? lastPulledAt;
        const changes: Record<string, { created: Record<string, unknown>[]; updated: Record<string, unknown>[]; deleted: string[] }> = {};

        for (const table of TABLE_NAMES) {
          changes[table] = await pullChangesForTable(table, timestamp);
        }

        return {
          changes: changes as any,
          timestamp: syncStartedAt,
        };
      },
      pushChanges: async ({ changes }) => {
        for (const table of TABLE_NAMES) {
          const tableChanges = (changes as any)[table];
          if (tableChanges) {
            await pushChangesForTable(table, tableChanges);
          }
        }
      },
      migrationsEnabledAtVersion: 1,
    });

    await AsyncStorage.setItem(LAST_SYNC_KEY, syncStartedAt.toString());
    console.log('[offline] Sync completed successfully');
  } catch (err) {
    console.error('[offline] Sync failed:', err);
  }
}

/**
 * Runs a full sync when the app opens. Handles first-time sync (full pull)
 * by checking if lastSyncTimestamp exists.
 */
export async function syncOnAppOpen(): Promise<void> {
  try {
    const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (!lastSync) {
      console.log('[offline] First-time sync — performing full pull');
    }
    await syncDatabase();
  } catch (err) {
    console.error('[offline] syncOnAppOpen error:', err);
  }
}

/**
 * Triggered when the device regains network connectivity.
 * Pushes any locally queued changes to Supabase.
 */
export async function syncOnConnectivityChange(): Promise<void> {
  try {
    await syncDatabase();
  } catch (err) {
    console.error('[offline] syncOnConnectivityChange error:', err);
  }
}

// -----------------------------------------------------------------------------
// Network Connectivity Listener
// -----------------------------------------------------------------------------

let unsubscribeNetInfo: (() => void) | null = null;

/**
 * Starts listening for network connectivity changes.
 * Automatically triggers sync when the device comes back online.
 */
export function startNetworkListener(): void {
  if (unsubscribeNetInfo) return;

  let wasConnected = true;

  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    const isConnected = state.isConnected ?? false;

    // Trigger sync when transitioning from offline to online
    if (!wasConnected && isConnected) {
      console.log('[offline] Network restored, triggering sync');
      syncOnConnectivityChange();
    }

    wasConnected = isConnected;
  });
}

/**
 * Stops the network connectivity listener.
 */
export function stopNetworkListener(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
}

// -----------------------------------------------------------------------------
// Cache Management
// -----------------------------------------------------------------------------

/** Directory where cached textures and thumbnails are stored. */
const CACHE_DIR = `${FileSystem.cacheDirectory}drapnr/`;

/**
 * Returns the approximate size (in bytes) of the local cache.
 * Includes the WatermelonDB SQLite file and cached images.
 */
export async function getCacheSize(): Promise<number> {
  let totalSize = 0;

  try {
    // Check SQLite database file size
    const dbPath = `${FileSystem.documentDirectory}SQLite/drapnr.db`;
    const dbInfo = await FileSystem.getInfoAsync(dbPath);
    if (dbInfo.exists && 'size' in dbInfo) {
      totalSize += dbInfo.size ?? 0;
    }
  } catch {
    // SQLite file may not exist yet
  }

  try {
    // Check cached images directory size
    const cacheInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (cacheInfo.exists) {
      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      for (const file of files) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(`${CACHE_DIR}${file}`);
          if (fileInfo.exists && 'size' in fileInfo) {
            totalSize += fileInfo.size ?? 0;
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  } catch {
    // Cache directory may not exist yet
  }

  return totalSize;
}

/**
 * Deletes all locally cached records, images, and resets the sync timestamp.
 * Useful when the user signs out.
 */
export async function clearCache(): Promise<void> {
  try {
    // Reset the WatermelonDB database
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
    console.log('[offline] WatermelonDB reset');
  } catch (err) {
    console.error('[offline] Failed to reset database:', err);
  }

  try {
    // Delete cached images
    const cacheInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (cacheInfo.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    }
    console.log('[offline] Image cache cleared');
  } catch (err) {
    console.error('[offline] Failed to clear image cache:', err);
  }

  try {
    // Reset sync timestamp
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
    console.log('[offline] Sync timestamp reset');
  } catch (err) {
    console.error('[offline] Failed to reset sync timestamp:', err);
  }
}
