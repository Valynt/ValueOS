/**
 * Application Constants
 */

export const APP_NAME = "Valynt";
export const APP_VERSION = "0.1.0";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  DASHBOARD: "/dashboard",
  SETTINGS: "/settings",
  BILLING: "/billing",
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    LOGOUT: "/auth/logout",
    SIGNUP: "/auth/signup",
    REFRESH: "/auth/refresh",
  },
  USER: {
    ME: "/user/me",
    UPDATE: "/user/update",
  },
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER: "user",
  THEME: "theme",
} as const;

export const QUERY_KEYS = {
  USER: ["user"],
  BILLING: ["billing"],
} as const;
