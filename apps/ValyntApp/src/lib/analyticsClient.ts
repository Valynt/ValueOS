// Stub analytics client for development
export const analyticsClient = {
  identify: (userId: string, traits?: Record<string, any>) => {
    console.log("Analytics identify:", userId, traits);
  },
  track: (event: string, properties?: Record<string, any>) => {
    console.log("Analytics track:", event, properties);
  },
  trackEvent: (eventName: string, eventParams?: Record<string, unknown>) => {
    console.log("Analytics trackEvent:", eventName, eventParams);
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
