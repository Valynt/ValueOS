const TENANT_CACHE_CLEAR_EVENT = "valynt:tenant-cache-clear";

const LOCAL_STORAGE_CACHE_PREFIXES = ["cache_"];
const LOCAL_STORAGE_CACHE_KEYS = ["valueos-state"];

function removePrefixedStorageKeys(storage: Storage, prefixes: readonly string[]): void {
  const keysToRemove = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => Boolean(key) && prefixes.some((prefix) => key.startsWith(prefix))
  );

  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

function removeStorageKeys(storage: Storage, keys: readonly string[]): void {
  for (const key of keys) {
    storage.removeItem(key);
  }
}

export function clearTenantScopedBrowserCaches(): void {
  if (typeof window === "undefined") {
    return;
  }

  removePrefixedStorageKeys(window.localStorage, LOCAL_STORAGE_CACHE_PREFIXES);
  removeStorageKeys(window.localStorage, LOCAL_STORAGE_CACHE_KEYS);
}

export function broadcastTenantCacheClear(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(TENANT_CACHE_CLEAR_EVENT));
}

export function clearAndBroadcastTenantCacheReset(): void {
  clearTenantScopedBrowserCaches();
  broadcastTenantCacheClear();
}

export { TENANT_CACHE_CLEAR_EVENT };
