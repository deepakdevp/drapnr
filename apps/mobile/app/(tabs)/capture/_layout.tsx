// =============================================================================
// Capture Stack Layout
// =============================================================================

import { Stack } from 'expo-router';

export default function CaptureLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="recording" options={{ gestureEnabled: false }} />
      <Stack.Screen name="review" />
      <Stack.Screen name="processing" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
