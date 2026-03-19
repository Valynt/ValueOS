import { backendBaseExcludes, backendNonUnitTestPatterns, createBackendVitestConfig } from "./vitest.shared";

export default createBackendVitestConfig({
  name: "backend-unit",
  include: [
    "src/**/!(*.integration|*.int|*.e2e|*.perf|*.load|*.security).test.ts",
    "src/**/!(*.integration|*.int|*.e2e|*.perf|*.load).spec.ts",
  ],
  exclude: [...backendBaseExcludes, ...backendNonUnitTestPatterns],
});
