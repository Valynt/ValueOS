export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = "VOS Academy";

export const APP_LOGO = "https://placehold.co/128x128/E1E7EF/1F2937?text=App";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const url = new URL("/api/oauth/login", window.location.origin);
  url.searchParams.set("returnTo", returnTo || "/dashboard");
  return url.toString();
};
