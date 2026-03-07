import { describe, expect, it } from "vitest";

import { infraModeMatrix } from "./infra-mode.matrix";

describe("infraModeMatrix", () => {
  it("always includes local mode", () => {
    expect(infraModeMatrix.some((entry) => entry.mode === "local")).toBe(true);
  });

  it("sets expected env variable for each mode", () => {
    for (const mode of infraModeMatrix) {
      expect(mode.env.TEST_INFRA_MODE).toBe(mode.mode);
    }
  });
});
