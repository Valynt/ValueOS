"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTest = exports.isProduction = exports.isDevelopment = void 0;
const env = typeof process !== "undefined" ? process.env.NODE_ENV : "development";
exports.isDevelopment = env === "development";
exports.isProduction = env === "production";
exports.isTest = env === "test";
//# sourceMappingURL=environment.js.map