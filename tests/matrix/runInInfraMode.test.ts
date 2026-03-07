import { describe, expect, it } from "vitest";

import { runInInfraMode } from "./runInInfraMode";

describe("runInInfraMode", () => {
  it("temporarily applies infra env and restores previous values", async () => {
    process.env.TEST_INFRA_MODE = "original";

    await runInInfraMode(
      {
        id: "local",
        mode: "local",
        label: "Local",
        enabled: true,
        env: { TEST_INFRA_MODE: "local" },
      },
      "ns",
      async (ctx) => {
        expect(ctx.mode).toBe("local");
        expect(ctx.namespace).toBe("ns");
        expect(process.env.TEST_INFRA_MODE).toBe("local");
      },
    );

    expect(process.env.TEST_INFRA_MODE).toBe("original");
    delete process.env.TEST_INFRA_MODE;
  });
});
