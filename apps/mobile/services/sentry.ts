// =============================================================================
// Sentry Error Tracking Service
// =============================================================================
// Initializes Sentry when EXPO_PUBLIC_SENTRY_DSN is set.
// Falls back to no-op when DSN is not configured or SDK not installed.
// =============================================================================

import { createLogger } from '../utils/logger';

const log = createLogger('sentry');

let Sentry: any = null;

/**
 * Initialize Sentry if the DSN is configured and the SDK is available.
 * Call this once in the root layout before rendering.
 */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    log.debug('Sentry DSN not configured — error tracking disabled');
    return;
  }

  try {
    Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.2,
      debug: __DEV__,
    });
    log.debug('Sentry initialized');
  } catch {
    log.debug('Sentry SDK not installed — error tracking disabled');
  }
}

/**
 * Capture an exception in Sentry.
 * No-op if Sentry is not initialized.
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!Sentry) return;
  if (context) {
    Sentry.withScope((scope: any) => {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Identify the current user in Sentry.
 */
export function setUser(user: { id: string; email?: string } | null): void {
  if (!Sentry) return;
  Sentry.setUser(user);
}
