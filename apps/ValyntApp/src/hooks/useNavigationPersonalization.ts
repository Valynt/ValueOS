import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const MAX_RECENT_SEARCHES = 8;
const MAX_RECENT_PATHS = 15;

interface RouteUsage {
  count: number;
  lastVisitedAt: number;
}

export interface PersonalizationState {
  routeUsage: Record<string, RouteUsage>;
  featureUsage: Record<string, number>;
  recentSearches: string[];
  recentPaths: string[];
}

const DEFAULT_STATE: PersonalizationState = {
  routeUsage: {},
  featureUsage: {},
  recentSearches: [],
  recentPaths: [],
};

export function useNavigationPersonalization(scopeKey: string) {
  const [state, setState] = useLocalStorage<PersonalizationState>(
    `valynt.nav.personalization.${scopeKey}`,
    DEFAULT_STATE
  );

  const recordRouteVisit = (path: string) => {
    if (!path) return;

    setState((prev) => {
      const current = prev.routeUsage[path] ?? { count: 0, lastVisitedAt: Date.now() };
      const recentPaths = [path, ...prev.recentPaths.filter((p) => p !== path)].slice(
        0,
        MAX_RECENT_PATHS
      );

      return {
        ...prev,
        routeUsage: {
          ...prev.routeUsage,
          [path]: {
            count: current.count + 1,
            lastVisitedAt: Date.now(),
          },
        },
        recentPaths,
      };
    });
  };

  const recordFeatureUsage = (featureKey: string) => {
    if (!featureKey) return;

    setState((prev) => ({
      ...prev,
      featureUsage: {
        ...prev.featureUsage,
        [featureKey]: (prev.featureUsage[featureKey] ?? 0) + 1,
      },
    }));
  };

  const recordSearch = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;

    setState((prev) => ({
      ...prev,
      recentSearches: [
        normalized,
        ...prev.recentSearches.filter((item) => item !== normalized),
      ].slice(0, MAX_RECENT_SEARCHES),
      featureUsage: {
        ...prev.featureUsage,
        "topbar-search": (prev.featureUsage["topbar-search"] ?? 0) + 1,
      },
    }));
  };

  const rankedRoutes = useMemo(() => {
    return Object.entries(state.routeUsage)
      .sort(([, left], [, right]) => {
        if (right.count !== left.count) return right.count - left.count;
        return right.lastVisitedAt - left.lastVisitedAt;
      })
      .map(([path]) => path);
  }, [state.routeUsage]);

  return {
    state,
    rankedRoutes,
    recordRouteVisit,
    recordFeatureUsage,
    recordSearch,
  };
}
