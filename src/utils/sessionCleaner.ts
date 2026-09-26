/**
 * Utility functions for handling session cleanup, cache clearing, and refresh detection
 */

/**
 * Checks if the current page load is a result of a user refresh / reload (F5, Ctrl+R, reload button)
 */
export function isPageRefreshed(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Modern Performance Navigation Timing API
    if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0 && navEntries[0].type === 'reload') {
        return true;
      }
    }

    // 2. Legacy Navigation Timing API
    if (typeof performance !== 'undefined' && (performance as any)?.navigation) {
      if ((performance as any).navigation.type === 1) {
        return true;
      }
    }

    // 3. Session Storage marker set during beforeunload/unload
    if (typeof sessionStorage !== 'undefined') {
      if (sessionStorage.getItem('athree_page_refreshed') === 'true') {
        return true;
      }
    }
  } catch (err) {
    console.warn('Unable to detect page navigation state:', err);
  }

  return false;
}

/**
 * Marks that a page refresh / unload has occurred so subsequent load recognizes the refresh
 */
export function markPageForRefresh(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('athree_page_refreshed', 'true');
    }
  } catch {}
}

/**
 * Clears the refresh marker
 */
export function clearRefreshMark(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('athree_page_refreshed');
    }
  } catch {}
}

/**
 * Clears all cookies accessible via document.cookie across all paths and domain levels
 */
export function clearAllCookies(): void {
  if (typeof document === 'undefined') return;

  try {
    const cookies = document.cookie.split(';');
    const hostname = window.location.hostname;
    const paths = ['/', '/api', '/assets', ''];

    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
      if (!name) continue;

      // Clear for current path and root
      for (const p of paths) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${p};`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${p};domain=${hostname};`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${p};domain=.${hostname};`;
      }

      // Try domain variants if applicable
      const parts = hostname.split('.');
      if (parts.length > 2) {
        const rootDomain = parts.slice(-2).join('.');
        for (const p of paths) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${p};domain=.${rootDomain};`;
        }
      }
    }
  } catch (err) {
    console.warn('Error clearing cookies:', err);
  }
}

/**
 * Clears browser CacheStorage, ServiceWorker registrations, and sessionStorage
 */
export async function clearBrowserCaches(): Promise<void> {
  // 1. Clear CacheStorage (window.caches)
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
  } catch (err) {
    console.warn('Error clearing CacheStorage:', err);
  }

  // 2. Unregister Service Workers if present
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
  } catch (err) {
    console.warn('Error unregistering service workers:', err);
  }

  // 3. Clear sessionStorage completely
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch (err) {
    console.warn('Error clearing sessionStorage:', err);
  }
}

/**
 * Complete cleanup: Clears cookies, CacheStorage, and triggers server-side session cleanup
 */
export async function clearAllCachesAndCookies(): Promise<void> {
  clearAllCookies();
  await clearBrowserCaches();

  // Notify server to clear server-side session cookies / cache
  try {
    await fetch('/api/clear-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => {});
  } catch {}
}
