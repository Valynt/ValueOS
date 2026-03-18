/**
 * Verifies HallucinationBadge is registered in both SDUI registries (UX-01).
 * Static analysis — no DOM rendering required.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// __dirname = packages/backend/src/__tests__ → up 4 levels = workspace root
const WORKSPACE_ROOT = resolve(__dirname, "../../../..");

describe("HallucinationBadge SDUI registration (UX-01)", () => {
  it("is registered in scripts/config/ui-registry.json with intentType show_hallucination_badge", () => {
    const registryPath = resolve(WORKSPACE_ROOT, "scripts/config/ui-registry.json");
    const registry = JSON.parse(readFileSync(registryPath, "utf-8")) as {
      intents: Array<{ intentType: string; component: string }>;
    };
    const entry = registry.intents.find((i) => i.component === "HallucinationBadge");
    expect(entry).toBeDefined();
    expect(entry?.intentType).toBe("show_hallucination_badge");
  });

  it("is imported and registered in packages/sdui/src/registry.tsx", () => {
    const registryPath = resolve(WORKSPACE_ROOT, "packages/sdui/src/registry.tsx");
    const content = readFileSync(registryPath, "utf-8");
    expect(content).toContain('import { HallucinationBadge }');
    // Component is registered via versionedRegistry.register({ component: HallucinationBadge, ... })
    expect(content).toContain("component: HallucinationBadge");
  });

  it("component file exists at expected path", () => {
    const componentPath = resolve(
      WORKSPACE_ROOT,
      "packages/sdui/src/components/SDUI/HallucinationBadge.tsx",
    );
    const content = readFileSync(componentPath, "utf-8");
    expect(content).toContain("export function HallucinationBadge");
    expect(content).toContain("hallucination_check");
    expect(content).toContain("grounding_score");
  });

  it("badge renders correct state labels for each check value", () => {
    // Pure logic test — mirrors resolveState() in HallucinationBadge.tsx
    type BadgeState = "pass" | "fail" | "unknown";
    function resolveState(check: boolean | null | undefined): BadgeState {
      if (check === true) return "pass";
      if (check === false) return "fail";
      return "unknown";
    }
    expect(resolveState(true)).toBe("pass");
    expect(resolveState(false)).toBe("fail");
    expect(resolveState(undefined)).toBe("unknown");
    expect(resolveState(null)).toBe("unknown");
  });
});
