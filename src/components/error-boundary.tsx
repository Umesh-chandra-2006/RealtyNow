import { Component, type ReactNode } from 'react';
import { reportError } from '../lib/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Matches the two known symptoms of a stale/duplicate JS module graph:
//   1. A lazy route chunk failed to fetch (deleted/renamed after a deploy).
//   2. Two copies of React ended up loaded in the same page (typically a
//      service worker serving an old cached chunk alongside fresh ones),
//      so a hook call resolves against a null internal dispatcher —
//      surfaces as "Cannot read properties of null (reading 'useX')".
// Both are infrastructure-staleness bugs, not application bugs: the fix is
// to drop any stale cache and reload once, not to keep showing an error.
function isStaleModuleGraphError(error: Error): boolean {
  const message = error.message || '';
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    /Cannot read properties of null \(reading 'use[A-Z]\w*'\)/.test(message)
  );
}

// Best-effort cleanup so the reload actually gets fresh code instead of
// hitting the same stale cache again. Never blocks or throws — this is
// cache hygiene, not error handling, so failures here are silently ignored.
async function clearStaleCaches(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* best-effort */
  }
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.update().catch(() => r.unregister())));
    }
  } catch {
    /* best-effort */
  }
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    if (isStaleModuleGraphError(error)) {
      const hasRetried = sessionStorage.getItem('dynamic-import-retry');
      if (!hasRetried) {
        sessionStorage.setItem('dynamic-import-retry', 'true');
        clearStaleCaches().finally(() => window.location.reload());
      } else {
        sessionStorage.removeItem('dynamic-import-retry');
      }
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    if (isStaleModuleGraphError(error)) {
      return; // Handled by reload above
    }
    console.error('ErrorBoundary caught an error', error, errorInfo);
    reportError(error, { componentStack: errorInfo.componentStack });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6">
          <h2 className="text-2xl font-bold text-navy-900">Something went wrong</h2>
          <p className="text-navy-600 text-center max-w-md">
            {this.state.error?.message ?? 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
