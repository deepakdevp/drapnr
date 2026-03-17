// =============================================================================
// Mix & Match Stack Layout
// =============================================================================

import { Stack } from 'expo-router';

export default function MixMatchLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
