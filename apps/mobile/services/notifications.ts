// =============================================================================
// Notifications Service
// =============================================================================
// Push notification registration, handling, and listener setup using
// expo-notifications.
// =============================================================================

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import type { PushNotificationData } from '../types';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/** Default notification behaviour when app is in foreground. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// -----------------------------------------------------------------------------
// Registration
// -----------------------------------------------------------------------------

/**
 * Requests push notification permissions and returns the Expo push token.
 * On Android, also configures the default notification channel.
 *
 * Returns `null` if permission was denied or the token could not be obtained.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[notifications] Push notification permission denied');
    return null;
  }

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A1A2E',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

// -----------------------------------------------------------------------------
// Notification Handling
// -----------------------------------------------------------------------------

/**
 * Routes to the appropriate screen based on the notification data payload.
 */
export function handleNotification(notification: Notifications.Notification): void {
  const data = notification.request.content.data as PushNotificationData | undefined;

  if (!data?.type) return;

  switch (data.type) {
    case 'processing_complete':
      if (data.outfitId) {
        router.push(`/(tabs)/wardrobe/${data.outfitId}` as never);
      }
      break;

    case 'processing_failed':
      if (data.outfitId) {
        router.push(`/(tabs)/wardrobe/${data.outfitId}` as never);
      }
      break;

    case 'subscription_renewed':
      router.push('/(tabs)/profile' as never);
      break;

    case 'general':
    default:
      // No special routing for generic notifications
      break;
  }
}

// -----------------------------------------------------------------------------
// Listener Setup
// -----------------------------------------------------------------------------

/**
 * Registers foreground and background notification listeners.
 * Returns a cleanup function to remove all listeners.
 */
export function setupNotificationListeners(): () => void {
  // Fired when a notification is received while the app is foregrounded
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('[notifications] Received in foreground:', notification.request.identifier);
    },
  );

  // Fired when the user taps on a notification (foreground or background)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      handleNotification(response.notification);
    },
  );

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}
