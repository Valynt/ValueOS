import { useCallback, useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const MAX_RECENT_ROUTES = 8;
const MAX_RECENT_SEARCHES = 6;

interface NavigationPersonalizationState {
  routeUsage: Record<string, number>;
  recentRoutes: string[];
  recentSearches: string[];
}

const DEFAULT_STATE: NavigationPersonalizationState = {
  routeUsage: {},
  recentRoutes: [],
  recentSearches: [],
};

function normalizePath(path: string): string {
  if (!path || path === "/") return "/dashboard";
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return "/dashboard";
  return `/${segments[0]}`;
}

function uniqueRecent(items: string[], value: string, max: number): string[] {
  return [value, ...items.filter((item) => item !== value)].slice(0, max);
}

export function useNavigationPersonalization(storageScope = "global") {
  const [state, setState] = useLocalStorage<NavigationPersonalizationState>(
    `valynt.navigation.personalization.v1.${storageScope}`,
    DEFAULT_STATE,
  );

  const recordRouteVisit = useCallback((path: string) => {
    const normalizedPath = normalizePath(path);

    setState((prev) => ({
      ...prev,
      routeUsage: {
        ...prev.routeUsage,
        [normalizedPath]: (prev.routeUsage[normalizedPath] ?? 0) + 1,
      },
      recentRoutes: uniqueRecent(prev.recentRoutes, normalizedPath, MAX_RECENT_ROUTES),
    }));
  }, [setState]);

  const recordSearch = useCallback((searchQuery: string) => {
    const query = searchQuery.trim();
    if (!query) return;

    setState((prev) => ({
      ...prev,
      recentSearches: uniqueRecent(prev.recentSearches, query, MAX_RECENT_SEARCHES),
    }));
  }, [setState]);

  const frequentRoutePaths = useMemo(
    () =>
      Object.entries(state.routeUsage)
        .sort((a, b) => b[1] - a[1])
        .map(([path]) => path),
    [state.routeUsage],
  );

  return {
    routeUsage: state.routeUsage,
    recentRoutes: state.recentRoutes,
    recentSearches: state.recentSearches,
    frequentRoutePaths,
    recordRouteVisit,
    recordSearch,
  };
}
