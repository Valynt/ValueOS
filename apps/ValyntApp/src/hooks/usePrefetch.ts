import { useCallback } from "react";

/**
 * Hook for prefetching routes and resources
 */
export const usePrefetch = () => {
  const prefetchRoute = useCallback(async (route: string) => {
    // For React Router, we can preload route components
    // This is a simplified implementation - in practice, you'd integrate
    // with your route definitions and lazy loading
    console.debug("Prefetching route:", route);

    // Example: preload critical components based on route
    switch (route) {
      case "/dashboard":
        // Preload dashboard components
        import("../views/Dashboard");
        break;
      case "/projects":
        // Preload projects components
        import("../views/Projects");
        break;
      case "/agents":
        // Preload agents components
        import("../views/Agents");
        break;
      default:
        break;
    }
  }, []);

  const prefetchResource = useCallback(async (url: string) => {
    // Prefetch static resources
    if ("serviceWorker" in navigator && "caches" in window) {
      try {
        const cache = await caches.open("prefetch-cache");
        await cache.add(url);
      } catch (error) {
        console.warn("Resource prefetch failed:", error);
      }
    }
  }, []);

  return { prefetchRoute, prefetchResource };
};
