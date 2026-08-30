import * as Sentry from '@sentry/react';

let initialized = false;
let enabled = false;

/**
 * Initialise Sentry for browser error/performance monitoring.
 * Safe to call multiple times; a no-op unless VITE_SENTRY_DSN is configured.
 */
export function initSentry(): void {
  if (initialized) return;
  initialized = true;

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  enabled = true;
  Sentry.init({
    dsn,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

export function isSentryEnabled(): boolean {
  return enabled;
}

/**
 * Report a caught error to Sentry (no-op when Sentry is not configured).
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled || !initialized) return;
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}
