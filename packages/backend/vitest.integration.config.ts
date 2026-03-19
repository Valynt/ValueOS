import { backendBaseExcludes, createBackendVitestConfig } from "./vitest.shared";

export default createBackendVitestConfig({
  name: "backend-integration",
  include: ["src/**/*.integration.test.ts"],
  exclude: backendBaseExcludes,
});
