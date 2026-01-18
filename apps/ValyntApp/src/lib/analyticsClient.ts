type AnalyticsInitOptions = {
  betaCohort?: boolean;
};

const STORAGE_KEYS = {
  userCreatedAt: "valueos.user_created_at",
};

function storeUserCreatedAt(timestamp: number) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(STORAGE_KEYS.userCreatedAt, String(timestamp));
}

function getUserCreatedAt(): number | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const value = window.localStorage.getItem(STORAGE_KEYS.userCreatedAt);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function enrichWithTimeToFirstValue(event: string, properties?: Record<string, unknown>) {
  if (event !== "asset_created") return properties;
  const createdAt = getUserCreatedAt();
  if (!createdAt) return properties;
  const durationMs = Date.now() - createdAt;
  return {
    ...properties,
    time_to_first_value_ms: durationMs,
  };
}

// Stub analytics client for development
export const analyticsClient = {
  initialize: (options: AnalyticsInitOptions = {}) => {
    console.log("Analytics initialize:", options);
  },
  identify: (userId: string, traits?: Record<string, unknown>) => {
    console.log("Analytics identify:", userId, traits);
  },
  track: (event: string, properties?: Record<string, any>) => {
    if (event === "user_created") {
      storeUserCreatedAt(Date.now());
    }
    const enriched = enrichWithTimeToFirstValue(event, properties);
    console.log("Analytics track:", event, enriched);
  },
  trackEvent: (eventName: string, eventParams?: Record<string, unknown>) => {
    console.log("Analytics trackEvent:", eventName, eventParams);
  },
  trackWorkflowEvent: (eventName: string, workflow: string, properties?: Record<string, unknown>) => {
    const enriched = enrichWithTimeToFirstValue(eventName, {
      ...properties,
      workflow,
    });
    console.log("Analytics workflow event:", eventName, enriched);
  },
  trackPageView: (pagePath: string, pageTitle: string) => {
    console.log("Analytics trackPageView:", pagePath, pageTitle);
  },
  identifyUser: (userId: string, traits?: Record<string, any>) => {
    console.log("Analytics identifyUser:", userId, traits);
  },
  resetAnalytics: () => {
    console.log("Analytics reset");
  },
};
