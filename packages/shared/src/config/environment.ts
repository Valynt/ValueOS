import { env } from "../lib/env";

export const isDevelopment = () => env.isDevelopment;
export const isProduction = () => env.isProduction;
export const isTest = () => env.isTest;
