// =============================================================================
// Offline / WatermelonDB Service
// =============================================================================
// Local-first schema definition, sync functions, and cache management.
// In production this would use @nozbe/watermelondb; the current implementation
// provides the schema shape and stub functions.
// =============================================================================

import { appSchema, tableSchema } from '@nozbe/watermelondb';
import type { AppSchema } from '@nozbe/watermelondb';

// -----------------------------------------------------------------------------
// Schema Definition
// -----------------------------------------------------------------------------

/**
 * WatermelonDB schema that mirrors the Supabase tables used by Drapnr.
 * Each table includes a `server_id` column for sync mapping and standard
 * `created_at` / `updated_at` timestamps managed by WatermelonDB.
 */
export const drapnrSchema: AppSchema = appSchema({
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
        { name: 'metadata', type: 'string' }, // JSON stringified
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
// Sync Functions
// -----------------------------------------------------------------------------

/**
 * Runs a full sync when the app opens. In production this would use
 * WatermelonDB's `synchronize()` with a Supabase-backed sync adapter.
 */
export async function syncOnAppOpen(): Promise<void> {
  // TODO: Implement with WatermelonDB synchronize()
  // import { synchronize } from '@nozbe/watermelondb/sync';
  //
  // await synchronize({
  //   database,
  //   pullChanges: async ({ lastPulledAt }) => { ... },
  //   pushChanges: async ({ changes }) => { ... },
  // });
  console.log('[offline] syncOnAppOpen — stub');
}

/**
 * Triggered when the device regains network connectivity.
 * Pushes any locally queued changes to Supabase.
 */
export async function syncOnConnectivityChange(): Promise<void> {
  // TODO: Listen to NetInfo and trigger sync when reconnected
  console.log('[offline] syncOnConnectivityChange — stub');
}

// -----------------------------------------------------------------------------
// Cache Management
// -----------------------------------------------------------------------------

/**
 * Deletes all locally cached records. Useful when the user signs out.
 */
export async function clearCache(): Promise<void> {
  // TODO: database.write(async () => { await database.unsafeResetDatabase(); });
  console.log('[offline] clearCache — stub');
}

/**
 * Returns the approximate size (in bytes) of the local WatermelonDB database.
 * On iOS/Android this checks the SQLite file size on disk.
 */
export async function getCacheSize(): Promise<number> {
  // TODO: Use expo-file-system to stat the database file
  // import * as FileSystem from 'expo-file-system';
  // const info = await FileSystem.getInfoAsync(dbPath);
  // return info.exists ? info.size : 0;
  return 0;
}
