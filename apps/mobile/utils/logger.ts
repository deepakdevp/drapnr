// =============================================================================
// Logger Utility
// =============================================================================
// Lightweight logger that only outputs in __DEV__ mode.
// In production builds, all logs are silenced except errors (for Sentry).
// =============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const NOOP = () => {};

function createLogger(prefix: string) {
  const tag = `[${prefix}]`;

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return {
      debug: (...args: unknown[]) => console.debug(tag, ...args),
      info: (...args: unknown[]) => console.info(tag, ...args),
      warn: (...args: unknown[]) => console.warn(tag, ...args),
      error: (...args: unknown[]) => console.error(tag, ...args),
    };
  }

  // Production: only errors pass through (for Sentry/crash reporting)
  return {
    debug: NOOP as (...args: unknown[]) => void,
    info: NOOP as (...args: unknown[]) => void,
    warn: NOOP as (...args: unknown[]) => void,
    error: (...args: unknown[]) => console.error(tag, ...args),
  };
}

export { createLogger };
export type { LogLevel };
