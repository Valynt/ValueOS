"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvironment = exports.isTest = exports.isProduction = exports.isDevelopment = void 0;
const isDevelopment = () => process.env.NODE_ENV === "development";
exports.isDevelopment = isDevelopment;
const isProduction = () => process.env.NODE_ENV === "production";
exports.isProduction = isProduction;
const isTest = () => process.env.NODE_ENV === "test";
exports.isTest = isTest;
const getEnvironment = () => process.env.NODE_ENV || "development";
exports.getEnvironment = getEnvironment;
//# sourceMappingURL=environment.js.map