// =============================================================================
// useNetworkStatus Hook
// =============================================================================
// Monitors network connectivity using @react-native-community/netinfo.
// Automatically triggers offline sync when the device comes back online.
// =============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import NetInfo, { type NetInfoState, type NetInfoStateType } from '@react-native-community/netinfo';

import { syncDatabase } from '../services/offline';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NetworkStatus {
  /** Whether the device currently has network connectivity. */
  isConnected: boolean;
  /** Whether the device is on a Wi-Fi connection. */
  isWifi: boolean;
  /** The type of connection (wifi, cellular, none, etc.). */
  connectionType: NetInfoStateType | null;
  /** Manually trigger a sync. */
  triggerSync: () => Promise<void>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useNetworkStatus(): NetworkStatus {
  const [isConnected, setIsConnected] = useState(true);
  const [isWifi, setIsWifi] = useState(false);
  const [connectionType, setConnectionType] = useState<NetInfoStateType | null>(null);
  const wasConnectedRef = useRef(true);

  const triggerSync = useCallback(async () => {
    try {
      await syncDatabase();
    } catch (err) {
      console.error('[useNetworkStatus] Sync failed:', err);
    }
  }, []);

  useEffect(() => {
    const handleNetworkChange = (state: NetInfoState) => {
      const connected = state.isConnected ?? false;
      const wifi = state.type === 'wifi';

      setIsConnected(connected);
      setIsWifi(wifi);
      setConnectionType(state.type);

      // Trigger sync when transitioning from offline to online
      if (!wasConnectedRef.current && connected) {
        console.log('[useNetworkStatus] Network restored, triggering sync');
        triggerSync();
      }

      wasConnectedRef.current = connected;
    };

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    // Fetch initial state
    NetInfo.fetch().then(handleNetworkChange);

    return () => {
      unsubscribe();
    };
  }, [triggerSync]);

  return {
    isConnected,
    isWifi,
    connectionType,
    triggerSync,
  };
}
