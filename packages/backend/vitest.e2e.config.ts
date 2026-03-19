import { backendBaseExcludes, createBackendVitestConfig } from "./vitest.shared";

export default createBackendVitestConfig({
  name: "backend-e2e",
  include: ["src/**/*.e2e.test.ts"],
  exclude: backendBaseExcludes,
});
