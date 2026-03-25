import { Alert, Linking, Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';

/**
 * Request camera permission with an explanation alert if previously denied.
 * Returns true if permission is granted.
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status: existingStatus } = await Camera.getCameraPermissionsAsync();

  if (existingStatus === 'granted') return true;

  if (existingStatus === 'denied') {
    return new Promise((resolve) => {
      Alert.alert(
        'Camera Access Required',
        'Drapnr needs camera access to capture your outfits. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Open Settings',
            onPress: () => {
              openAppSettings();
              resolve(false);
            },
          },
        ],
      );
    });
  }

  const { status } = await Camera.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request push notification permission.
 * Returns true if permission is granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') return true;

  if (existingStatus === 'denied') {
    return new Promise((resolve) => {
      Alert.alert(
        'Notifications',
        'Enable notifications to get updates when your outfits are done processing.',
        [
          { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Open Settings',
            onPress: () => {
              openAppSettings();
              resolve(false);
            },
          },
        ],
      );
    });
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Open the device settings page for this app.
 */
export function openAppSettings(): void {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings();
  }
}

/**
 * Check all permissions and return their current status.
 */
export async function checkAllPermissions(): Promise<{
  camera: boolean;
  notifications: boolean;
}> {
  const [cameraResult, notifResult] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    Notifications.getPermissionsAsync(),
  ]);

  return {
    camera: cameraResult.status === 'granted',
    notifications: notifResult.status === 'granted',
  };
}
