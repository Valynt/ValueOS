import fs from "fs";

import { describe, expect, it } from "vitest";

describe("Seed demo password", () => {
  it("does not embed a static default demo password and requires secure handling", () => {
    const content = fs.readFileSync("scripts/seed-demo-user.ts", "utf8");

    expect(content).not.toContain("DEFAULT_DEMO_PASSWORD");
    expect(content).not.toContain("passw0rd");
    expect(content).toContain("DEMO_USER_PASSWORD");
    expect(content).toContain("crypto.randomBytes");
    expect(content).toContain("isStrongPassword");
  });
});
