type EventProperties = Record<string, string | number | boolean | undefined>;

interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
}

const config: AnalyticsConfig = {
  enabled: import.meta.env.VITE_ANALYTICS_ENABLED === "true",
  debug: import.meta.env.DEV,
};

export function trackEvent(eventName: string, properties?: EventProperties): void {
  if (!config.enabled) {
    if (config.debug) {
      console.log("[Analytics] Event (disabled):", eventName, properties);
    }
    return;
  }

  try {
    // Push to dataLayer for GTM or similar
    if (typeof window !== "undefined" && window.dataLayer) {
      window.dataLayer.push({
        event: eventName,
        ...properties,
      });
    }

    if (config.debug) {
      console.log("[Analytics] Event:", eventName, properties);
    }
  } catch (error) {
    console.error("[Analytics] Failed to track event:", error);
  }
}

export function trackPageView(path: string, title?: string): void {
  trackEvent("page_view", {
    page_path: path,
    page_title: title,
  });
}

export function identifyUser(userId: string, traits?: EventProperties): void {
  if (!config.enabled) return;

  try {
    if (typeof window !== "undefined" && window.dataLayer) {
      window.dataLayer.push({
        event: "identify",
        user_id: userId,
        ...traits,
      });
    }

    if (config.debug) {
      console.log("[Analytics] Identify:", userId, traits);
    }
  } catch (error) {
    console.error("[Analytics] Failed to identify user:", error);
  }
}

export function resetAnalytics(): void {
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push({
      event: "reset",
      user_id: undefined,
    });
  }
}

