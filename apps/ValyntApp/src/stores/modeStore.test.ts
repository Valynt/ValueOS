/**
 * TDD tests for modeStore — Phase 2 Workspace Core
 *
 * Tests the Zustand store that manages workspace mode state:
 * activeMode, inspectorOpen, density. Written before implementation.
 */

import { afterEach, describe, expect, it } from "vitest";

// The store does not exist yet — this import will fail until implemented.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { useModeStore } from "./modeStore";

// Reset store between tests to avoid state leakage
afterEach(() => {
  useModeStore.getState().setActiveMode("canvas");
  useModeStore.getState().setInspectorOpen(false);
  useModeStore.getState().setDensity("comfortable");
});

describe("modeStore", () => {
  it("initializes with canvas as default mode", () => {
    const { activeMode } = useModeStore.getState();
    expect(activeMode).toBe("canvas");
  });

  it("setActiveMode updates activeMode to narrative", () => {
    useModeStore.getState().setActiveMode("narrative");
    expect(useModeStore.getState().activeMode).toBe("narrative");
  });

  it("setActiveMode updates activeMode to copilot", () => {
    useModeStore.getState().setActiveMode("copilot");
    expect(useModeStore.getState().activeMode).toBe("copilot");
  });

  it("setActiveMode updates activeMode to evidence", () => {
    useModeStore.getState().setActiveMode("evidence");
    expect(useModeStore.getState().activeMode).toBe("evidence");
  });

  it("setInspectorOpen toggles inspector panel to true", () => {
    useModeStore.getState().setInspectorOpen(true);
    expect(useModeStore.getState().inspectorOpen).toBe(true);
  });

  it("setInspectorOpen toggles inspector panel to false", () => {
    useModeStore.getState().setInspectorOpen(true);
    useModeStore.getState().setInspectorOpen(false);
    expect(useModeStore.getState().inspectorOpen).toBe(false);
  });

  it("initializes inspectorOpen as false", () => {
    expect(useModeStore.getState().inspectorOpen).toBe(false);
  });

  it("setDensity accepts compact", () => {
    useModeStore.getState().setDensity("compact");
    expect(useModeStore.getState().density).toBe("compact");
  });

  it("setDensity accepts comfortable", () => {
    useModeStore.getState().setDensity("comfortable");
    expect(useModeStore.getState().density).toBe("comfortable");
  });

  it("setDensity accepts spacious", () => {
    useModeStore.getState().setDensity("spacious");
    expect(useModeStore.getState().density).toBe("spacious");
  });

  it("initializes density as comfortable", () => {
    expect(useModeStore.getState().density).toBe("comfortable");
  });
});
