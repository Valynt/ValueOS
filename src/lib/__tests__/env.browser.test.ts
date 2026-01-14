import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnvVar, isBrowser, __setEnvSourceForTests } from "../env";

describe("env adapter (browser runtime)", () => {
  const originalImportMeta = import.meta;
  const originalProcess = globalThis.process;

  beforeEach(() => {
    // Simulate browser: window/document defined, process undefined
    vi.stubGlobal("window", {} as Window);
    vi.stubGlobal("document", {} as Document);
    // @ts-expect-error – remove Node globals for this test
    globalThis.process = undefined;

    // Set up browser environment using test helper
    __setEnvSourceForTests({ VITE_CLIENT_ONLY: "browser-value" });
  });

  it("uses import.meta.env instead of process.env", () => {
    expect(isBrowser()).toBe(true);
    expect(getEnvVar("VITE_CLIENT_ONLY")).toBe("browser-value");
  });

  it("throws scoped error when required browser env is missing", () => {
    expect(() => getEnvVar("VITE_MISSING", { required: true, scope: "browser" })).toThrow(
      /Missing required browser environment variable: VITE_MISSING/
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(globalThis, "import.meta", {
      value: originalImportMeta,
      configurable: true,
    });
    globalThis.process = originalProcess;
    // Reset env source to original
    __setEnvSourceForTests({});
  });
});
