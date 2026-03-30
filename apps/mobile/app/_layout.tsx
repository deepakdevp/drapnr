// =============================================================================
// Root Layout
// =============================================================================
// Entry point for Expo Router. Loads fonts, manages splash, wraps providers.
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext, lightTheme, darkTheme } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { registerForPushNotifications, setupNotificationListeners } from '@/services/notifications';
import { syncOnAppOpen, startNetworkListener } from '@/services/offline';
import { initSentry, setUser as setSentryUser } from '@/services/sentry';

// Keep splash visible while loading resources
SplashScreen.preventAutoHideAsync();

// Initialize Sentry before anything else
initSentry();

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const bodyTemplate = useAuthStore((s) => s.bodyTemplate);
  const registerPushToken = useAuthStore((s) => s.registerPushToken);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const initializeSubscriptions = useSubscriptionStore((s) => s.initialize);
  const segments = useSegments();
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // Font loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'PlusJakartaSans-Regular': require('@/assets/fonts/PlusJakartaSans-Regular.ttf'),
          'PlusJakartaSans-Medium': require('@/assets/fonts/PlusJakartaSans-Medium.ttf'),
          'PlusJakartaSans-SemiBold': require('@/assets/fonts/PlusJakartaSans-SemiBold.ttf'),
          'PlusJakartaSans-Bold': require('@/assets/fonts/PlusJakartaSans-Bold.ttf'),
          'PlusJakartaSans-ExtraBold': require('@/assets/fonts/PlusJakartaSans-ExtraBold.ttf'),
          'Inter-Regular': require('@/assets/fonts/Inter-Regular.ttf'),
          'Inter-Medium': require('@/assets/fonts/Inter-Medium.ttf'),
          'Inter-SemiBold': require('@/assets/fonts/Inter-SemiBold.ttf'),
          'Inter-Bold': require('@/assets/fonts/Inter-Bold.ttf'),
        });
      } catch (e) {
        // Font loading failed — fall back to system fonts
        // Font loading failed — fall back to system fonts
      } finally {
        setFontsLoaded(true);
      }
    }

    loadFonts();
  }, []);

  // ---------------------------------------------------------------------------
  // Load dark mode preference
  // ---------------------------------------------------------------------------

  useEffect(() => {
    AsyncStorage.getItem('@drapnr/dark-mode').then((val) => {
      if (val === 'true') setIsDarkMode(true);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Initialize auth, subscriptions, push notifications, and sync
  // ---------------------------------------------------------------------------

  useEffect(() => {
    initializeAuth().then(() => setAuthInitialized(true));
  }, [initializeAuth]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Identify user in Sentry
    const user = useAuthStore.getState().user;
    if (user) setSentryUser({ id: user.id, email: user.email });

    // Initialize RevenueCat
    initializeSubscriptions();

    // Register push token
    registerForPushNotifications().then((token) => {
      if (token) registerPushToken(token);
    });

    // Start offline sync
    syncOnAppOpen();
    startNetworkListener();

    // Set up notification listeners
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Hide splash when ready
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (fontsLoaded) {
      setAppReady(true);
    }
  }, [fontsLoaded]);

  const onLayoutReady = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  // ---------------------------------------------------------------------------
  // Auth-based routing
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Wait for both fonts and auth initialization before routing
    if (!appReady || !authInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const hasCompletedOnboarding = bodyTemplate !== null;

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && !hasCompletedOnboarding && !inAuthGroup) {
      router.replace('/(auth)/onboarding');
    } else if (isAuthenticated && hasCompletedOnboarding && inAuthGroup) {
      router.replace('/(tabs)/wardrobe');
    }
  }, [isAuthenticated, bodyTemplate, segments, appReady, authInitialized]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!appReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root} onLayout={onLayoutReady}>
      <ThemeContext.Provider value={isDarkMode ? darkTheme : lightTheme}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeContext.Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
