import { useState, useEffect, useCallback, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { APP_INFO } from '../config/version';

export function usePWAUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checkStatus, setCheckStatus] = useState<string | null>(null);

  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const initialServerBuildRef = useRef<string | null>(null);

  useEffect(() => {
    // Only register if service worker is supported
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('[PWA] New version ready for activation');
          setNeedRefresh(true);
        },
        onOfflineReady() {
          console.log('[PWA] App cached for offline use');
          setOfflineReady(true);
        },
        onRegisteredSW(swUrl, registration) {
          if (registration) {
            registrationRef.current = registration;
            console.log('[PWA] Service Worker registered at:', swUrl);

            // Initial check
            registration.update().catch((e) => console.warn('[PWA] Initial update check failed:', e));
          }
        },
        onRegisterError(error) {
          console.warn('[PWA] Service worker registration error:', error);
        },
      });

      updateSWRef.current = updateSW;
    } catch (e) {
      console.warn('[PWA] Failed to initialize registerSW:', e);
    }

    // When the controlling service worker changes, reload page to activate new bundle
    let refreshing = false;
    const handleControllerChange = () => {
      console.log('[PWA] Controller changed (new service worker is active). Reloading to apply update...');
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  // Check version on server
  const checkServerVersion = useCallback(async (): Promise<boolean> => {
    try {
      // Query /api/version with cache-busting timestamp
      const res = await fetch(`/api/version?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (!res.ok) return false;
      const data = await res.json();
      const serverBuildTime = data.buildTime;
      const serverVersion = data.version;

      // 1. Direct version string comparison with client's compiled version
      if (serverVersion && serverVersion !== APP_INFO.version) {
        console.log(`[PWA] Server version (${serverVersion}) != Client version (${APP_INFO.version}). Update needed.`);
        return true;
      }

      // 2. Server build time changed
      if (initialServerBuildRef.current && initialServerBuildRef.current !== serverBuildTime) {
        console.log('[PWA] Server build time changed from', initialServerBuildRef.current, 'to', serverBuildTime);
        return true;
      }

      initialServerBuildRef.current = serverBuildTime;
    } catch (e) {
      console.warn('[PWA] Error checking /api/version:', e);
    }
    return false;
  }, []);

  // Comprehensive check for updates
  const checkForUpdate = useCallback(async (): Promise<{ updated: boolean; message: string }> => {
    setIsChecking(true);
    setCheckStatus('Checking for latest updates...');
    setLastChecked(new Date());

    try {
      let updateFound = false;

      // 1. Check Service Worker registration update
      if (registrationRef.current) {
        try {
          await registrationRef.current.update();
          if (registrationRef.current.waiting) {
            setNeedRefresh(true);
            updateFound = true;
          }
        } catch (swErr) {
          console.warn('[PWA] SW update check failed:', swErr);
        }
      }

      // 2. Check Server version endpoint
      const serverHasNewBuild = await checkServerVersion();
      if (serverHasNewBuild) {
        setNeedRefresh(true);
        updateFound = true;
      }

      if (updateFound || needRefresh) {
        setCheckStatus('New version available! Tap Update.');
        return { updated: true, message: 'A new version has been deployed and is ready to load.' };
      } else {
        setCheckStatus(`You are on the latest version (v${APP_INFO.version}).`);
        setTimeout(() => setCheckStatus(null), 4000);
        return { updated: false, message: 'You are on the latest version.' };
      }
    } finally {
      setIsChecking(false);
    }
  }, [checkServerVersion, needRefresh]);

  // Run update check on app launch and whenever user switches back to the app on mobile
  useEffect(() => {
    const launchTimer = setTimeout(() => {
      if (registrationRef.current) {
        registrationRef.current.update().catch(() => {});
      }
      checkServerVersion().then((hasUpdate) => {
        if (hasUpdate) setNeedRefresh(true);
      });
    }, 1500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (registrationRef.current) {
          registrationRef.current.update().catch(() => {});
        }
        checkServerVersion().then((hasUpdate) => {
          if (hasUpdate) setNeedRefresh(true);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearTimeout(launchTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [checkServerVersion]);

  // Apply update and reload
  const updateApp = useCallback(async () => {
    if (updateSWRef.current) {
      try {
        await updateSWRef.current(true);
      } catch (e) {
        console.warn('[PWA] updateSW error, falling back to window.location.reload:', e);
        window.location.reload();
      }
    } else {
      window.location.reload();
    }
  }, []);

  // Force purge all caches and hard reload
  const forceClearCacheAndReload = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
      }
    } catch (e) {
      console.warn('[PWA] Error purging caches:', e);
    } finally {
      // Force reload ignoring cache with cache buster query
      window.location.replace(window.location.origin + window.location.pathname + '?_force_update=' + Date.now());
    }
  }, []);

  return {
    needRefresh,
    offlineReady,
    isChecking,
    checkStatus,
    lastChecked,
    checkForUpdate,
    updateApp,
    forceClearCacheAndReload,
    dismissRefreshPrompt: () => setNeedRefresh(false),
  };
}
