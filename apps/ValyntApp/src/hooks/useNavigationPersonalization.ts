import { useCallback, useEffect, useMemo, useState } from "react";

const PERSONALIZATION_STORAGE_KEY = "valynt_personalization_v1";
const MAX_RECENT_SEARCHES = 5;

interface PersonalizationState {
  routeUsage: Record<string, number>;
  featureUsage: Record<string, number>;
  recentSearches: string[];
}

const DEFAULT_STATE: PersonalizationState = {
  routeUsage: {},
  featureUsage: {},
  recentSearches: [],
};

const PERSONALIZATION_UPDATED_EVENT = "valynt:personalization:updated";

function loadPersonalizationState(): PersonalizationState {
  try {
    const raw = localStorage.getItem(PERSONALIZATION_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;

    const parsed = JSON.parse(raw) as Partial<PersonalizationState>;
    return {
      routeUsage: parsed.routeUsage ?? {},
      featureUsage: parsed.featureUsage ?? {},
      recentSearches: Array.isArray(parsed.recentSearches) ? parsed.recentSearches : [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function persistPersonalizationState(state: PersonalizationState) {
  try {
    localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(state));
    // Defer the cross-component sync event so it doesn't fire synchronously
    // inside a setState updater, which triggers the React "setState during
    // render of a different component" warning.
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent(PERSONALIZATION_UPDATED_EVENT));
    });
  } catch {
    // Best-effort persistence
  }
}

export function useNavigationPersonalization() {
  const [state, setState] = useState<PersonalizationState>(() => loadPersonalizationState());

  useEffect(() => {
    const syncState = () => {
      setState(loadPersonalizationState());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== PERSONALIZATION_STORAGE_KEY) return;
      syncState();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(PERSONALIZATION_UPDATED_EVENT, syncState);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(PERSONALIZATION_UPDATED_EVENT, syncState);
    };
  }, []);

  const trackRouteVisit = useCallback((path: string) => {
    if (!path) return;

    setState((prev) => {
      const next: PersonalizationState = {
        ...prev,
        routeUsage: {
          ...prev.routeUsage,
          [path]: (prev.routeUsage[path] ?? 0) + 1,
        },
      };

      persistPersonalizationState(next);
      return next;
    });
  }, []);

  const trackFeatureUsage = useCallback((feature: string) => {
    const normalized = feature.trim();
    if (!normalized) return;

    setState((prev) => {
      const next: PersonalizationState = {
        ...prev,
        featureUsage: {
          ...prev.featureUsage,
          [normalized]: (prev.featureUsage[normalized] ?? 0) + 1,
        },
      };

      persistPersonalizationState(next);
      return next;
    });
  }, []);

  const trackSearch = useCallback((query: string) => {
    const normalized = query.trim();
    if (!normalized) return;

    setState((prev) => {
      const deduped = prev.recentSearches.filter(
        (entry) => entry.toLocaleLowerCase() !== normalized.toLocaleLowerCase()
      );

      const next: PersonalizationState = {
        ...prev,
        recentSearches: [normalized, ...deduped].slice(0, MAX_RECENT_SEARCHES),
      };

      persistPersonalizationState(next);
      return next;
    });
  }, []);

  const getUsageCount = useCallback(
    (path: string) => {
      return state.routeUsage[path] ?? 0;
    },
    [state.routeUsage]
  );

  const getFeatureUsageCount = useCallback(
    (feature: string) => {
      return state.featureUsage[feature] ?? 0;
    },
    [state.featureUsage]
  );

  const frequentRouteSet = useMemo(() => {
    const sorted = Object.entries(state.routeUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .filter(([, count]) => count > 0)
      .map(([path]) => path);

    return new Set(sorted);
  }, [state.routeUsage]);

  return {
    routeUsage: state.routeUsage,
    featureUsage: state.featureUsage,
    recentSearches: state.recentSearches,
    trackRouteVisit,
    trackFeatureUsage,
    trackSearch,
    getUsageCount,
    getFeatureUsageCount,
    frequentRouteSet,
  };
}
