const env = typeof process !== "undefined" ? process.env.NODE_ENV : "development";
export const isDevelopment = env === "development";
export const isProduction = env === "production";
export const isTest = env === "test";
//# sourceMappingURL=environment.js.map