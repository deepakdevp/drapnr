// =============================================================================
// Sentry Configuration — Drapnr Mobile
// =============================================================================

import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

type Environment = "development" | "staging" | "production";

function getEnvironment(): Environment {
  const env = Constants.expoConfig?.extra?.EXPO_PUBLIC_ENV ?? process.env.EXPO_PUBLIC_ENV;

  switch (env) {
    case "production":
      return "production";
    case "staging":
      return "staging";
    default:
      return "development";
  }
}

// ---------------------------------------------------------------------------
// Sentry init
// ---------------------------------------------------------------------------

const environment = getEnvironment();

Sentry.init({
  dsn: Constants.expoConfig?.extra?.EXPO_PUBLIC_SENTRY_DSN ??
    process.env.EXPO_PUBLIC_SENTRY_DSN ??
    "",

  environment,

  // Release tracking — uses the app version from app.json
  release: Constants.expoConfig?.version
    ? `drapnr-mobile@${Constants.expoConfig.version}`
    : undefined,
  dist: Constants.expoConfig?.runtimeVersion?.toString(),

  // Performance monitoring
  tracesSampleRate: environment === "production" ? 0.2 : 1.0,

  // Session replay (sample rates)
  replaysSessionSampleRate: environment === "production" ? 0.1 : 0,
  replaysOnErrorSampleRate: 1.0,

  // Only send events in non-development environments
  enabled: environment !== "development",

  // Attach stack traces to all messages
  attachStacktrace: true,

  // Breadcrumbs for debugging
  maxBreadcrumbs: 50,

  // Additional context
  initialScope: {
    tags: {
      app: "drapnr-mobile",
    },
  },

  // Filter out noisy errors in development
  beforeSend(event) {
    if (environment === "development") {
      return null;
    }
    return event;
  },
});

export default Sentry;
