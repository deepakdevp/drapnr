// =============================================================================
// Auth Layout
// =============================================================================
// Stack navigator for authentication and onboarding screens.
// =============================================================================

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="body-template" />
    </Stack>
  );
}
