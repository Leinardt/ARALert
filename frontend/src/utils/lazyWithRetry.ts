import React from 'react';

/**
 * Wraps dynamic component imports with retry and auto-reload logic.
 *
 * In Single-Page Applications deployed to CDNs (like Vercel), when a new
 * deployment occurs, chunk hashes change. If a user transitions routes
 * after logging in, the browser may request an old chunk hash that no longer
 * exists, resulting in `Failed to fetch dynamically imported module`.
 *
 * This wrapper catches that failure, detects if it was a chunk loading error,
 * and automatically triggers a single page reload so the browser gets the
 * new bundle without showing a blank white screen.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | any>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const retryKey = 'aralert_chunk_retry_timestamp';
    const lastRetry = sessionStorage.getItem(retryKey);
    const now = Date.now();
    // Allow auto-refresh at most once every 12 seconds to prevent infinite reload loops
    const canRetry = !lastRetry || now - Number(lastRetry) > 12000;

    try {
      const component = await componentImport();
      if (component && component.default) {
        return component;
      }
      return { default: component };
    } catch (error: any) {
      const errorMsg = String(error?.message || error || '');
      const isChunkLoadError =
        error?.name === 'ChunkLoadError' ||
        errorMsg.includes('Failed to fetch dynamically imported module') ||
        errorMsg.includes('Loading chunk') ||
        errorMsg.includes('dynamically imported module') ||
        errorMsg.includes('Importing a module script failed');

      if (isChunkLoadError && canRetry) {
        sessionStorage.setItem(retryKey, String(now));
        console.warn('[ARALert] Stale chunk detected during navigation. Auto-refreshing to fetch latest version...', errorMsg);
        window.location.reload();
        // Return a pending promise so React waits for the page reload rather than unmounting
        return new Promise(() => {});
      }

      // If already retried or not a chunk error, rethrow to be caught by ErrorBoundary
      throw error;
    }
  });
}
