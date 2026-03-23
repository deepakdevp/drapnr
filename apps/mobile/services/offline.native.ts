// =============================================================================
// Native-only offline implementation (WatermelonDB + SQLite)
// This file is only imported dynamically on iOS/Android
// =============================================================================

import { createLogger } from '../utils/logger';

const log = createLogger('offline');

export async function syncDatabase(): Promise<void> {
  log.debug('syncDatabase called — native WatermelonDB sync not yet configured');
}

export async function syncOnAppOpen(): Promise<void> {
  log.debug('syncOnAppOpen called');
  await syncDatabase();
}

export async function syncOnConnectivityChange(): Promise<void> {
  log.debug('syncOnConnectivityChange called');
  await syncDatabase();
}

export function startNetworkListener(): void {
  log.debug('startNetworkListener called');
}

export function stopNetworkListener(): void {
  log.debug('stopNetworkListener called');
}

export async function getCacheSize(): Promise<number> {
  return 0;
}

export async function clearCache(): Promise<void> {
  log.debug('clearCache called');
}
