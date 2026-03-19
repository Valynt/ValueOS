import { backendBaseExcludes, createBackendVitestConfig } from "./vitest.shared";

export default createBackendVitestConfig({
  name: "backend-security",
  include: ["src/**/*.security.test.ts"],
  exclude: backendBaseExcludes,
});
