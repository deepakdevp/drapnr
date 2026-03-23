// =============================================================================
// Sentry Configuration — Drapnr Mobile
// =============================================================================
// This file is safe to import even when @sentry/react-native is not installed.
// The actual initialization is handled in services/sentry.ts via dynamic require.
// This file exists as a convention for Sentry's Expo plugin — if the SDK is
// installed, it will be picked up automatically.
// =============================================================================

let Sentry: any = null;

try {
  Sentry = require('@sentry/react-native');
} catch {
  // @sentry/react-native not installed — skip configuration
}

if (Sentry) {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
      tracesSampleRate: process.env.EXPO_PUBLIC_ENV === 'production' ? 0.2 : 1.0,
      enabled: process.env.EXPO_PUBLIC_ENV !== 'development',
      attachStacktrace: true,
      maxBreadcrumbs: 50,
      initialScope: {
        tags: { app: 'drapnr-mobile' },
      },
    });
  }
}

export default Sentry;
