import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getMissingLegacyZonePaths } from "./legacy-risk-gates";

describe("getMissingLegacyZonePaths", () => {
  it("reports configured legacy zones whose paths do not exist", () => {
    const root = mkdtempSync(join(tmpdir(), "legacy-risk-gates-"));
    mkdirSync(join(root, "apps", "ValyntApp", "src", "app", "routes"), {
      recursive: true,
    });

    const config = {
      legacyZones: [
        {
          name: "Missing legacy route zone",
          path: "apps/ValyntApp/src/routes/_legacy",
          characterizationPatterns: ["apps/ValyntApp/src/routes/_legacy/**/*.test.tsx"],
        },
        {
          name: "Existing relocated route zone",
          path: "apps/ValyntApp/src/app/routes",
          characterizationPatterns: ["apps/ValyntApp/src/app/routes/**/*.test.tsx"],
        },
      ],
      debtHeavyModules: [],
      strictIslands: [],
    };

    const missing = getMissingLegacyZonePaths(config, root);

    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      name: "Missing legacy route zone",
      path: "apps/ValyntApp/src/routes/_legacy",
    });
  });
});
