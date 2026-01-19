/**
 * Backend environment helpers
 *
 * Wraps shared env utilities with server-aware defaults.
 */

import {
  __getEnvSourceForTests,
  __setEnvSourceForTests,
  checkIsBrowser,
  getEnvVar,
  getGroundtruthConfig,
  getLLMCostTrackerConfig,
  getServerSupabaseConfig,
  getSupabaseConfig,
  setEnvVar,
  setEnvVarForTests,
} from "@shared/lib/env";

const isBrowserValue = checkIsBrowser();
const nodeEnv =
  typeof process !== "undefined" && process.env ? process.env.NODE_ENV : undefined;

export const env = {
  isDevelopment: nodeEnv === "development",
  isProduction: nodeEnv === "production",
  isTest: nodeEnv === "test",
  isBrowser: isBrowserValue,
  isServer: !isBrowserValue,
};

export function isBrowser(): boolean {
  return isBrowserValue;
}

export {
  __getEnvSourceForTests,
  __setEnvSourceForTests,
  getEnvVar,
  getGroundtruthConfig,
  getLLMCostTrackerConfig,
  getServerSupabaseConfig,
  getSupabaseConfig,
  setEnvVar,
  setEnvVarForTests,
};
