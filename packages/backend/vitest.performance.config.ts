import { backendBaseExcludes, createBackendVitestConfig } from "./vitest.shared";

export default createBackendVitestConfig({
  name: "backend-performance",
  include: ["src/**/*.perf.test.ts", "src/**/*.load.test.ts"],
  exclude: backendBaseExcludes,
});
