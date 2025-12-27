import {
  getConfig,
  validateEnvironmentConfig,
} from "../src/config/environment";

console.log("Verifying Sentry Configuration...");

const config = getConfig();
const errors = validateEnvironmentConfig(config);

console.log("Current Environment:", config.app.env);
console.log("Sentry Enabled:", config.monitoring.sentry.enabled);
console.log("Sentry DSN Set:", !!config.monitoring.sentry.dsn);

if (config.monitoring.sentry.enabled && !config.monitoring.sentry.dsn) {
  console.error("FAIL: Sentry is enabled but DSN is missing!");
  process.exit(1);
}

if (errors.length > 0) {
  console.warn("Configuration Warnings:", errors);
} else {
  console.log("Configuration Valid.");
}

if (!config.monitoring.sentry.enabled) {
  console.log(
    "NOTE: Sentry is disabled. Set VITE_SENTRY_ENABLED=true and provide VITE_SENTRY_DSN to enable."
  );
}
