// =============================================================================
// Native-only offline implementation (WatermelonDB + SQLite)
// This file is only imported dynamically on iOS/Android
// =============================================================================

export async function syncDatabase(): Promise<void> {
  console.log('[offline] syncDatabase called — native WatermelonDB sync not yet configured');
}

export async function syncOnAppOpen(): Promise<void> {
  console.log('[offline] syncOnAppOpen called');
  await syncDatabase();
}

export async function syncOnConnectivityChange(): Promise<void> {
  console.log('[offline] syncOnConnectivityChange called');
  await syncDatabase();
}

export function startNetworkListener(): void {
  console.log('[offline] startNetworkListener called');
}

export function stopNetworkListener(): void {
  console.log('[offline] stopNetworkListener called');
}

export async function getCacheSize(): Promise<number> {
  return 0;
}

export async function clearCache(): Promise<void> {
  console.log('[offline] clearCache called');
}
