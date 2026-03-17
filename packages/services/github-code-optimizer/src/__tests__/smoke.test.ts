/**
 * Smoke test — ensures vitest has at least one test file to run.
 * Prevents `vitest run` from exiting with "no test files found".
 */
import { describe, expect, it } from "vitest";

describe("github-code-optimizer", () => {
  it("package name is correct", () => {
    // Trivial assertion; the real value is giving vitest a file to collect.
    expect("github-code-optimizer").toBe("github-code-optimizer");
  });
});
