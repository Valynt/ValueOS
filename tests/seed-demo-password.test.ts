import fs from "fs";
import { describe, it, expect } from "vitest";

describe("Seed demo password", () => {
  it("has a default demo password of at least 8 characters and matches 'passw0rd'", () => {
    const content = fs.readFileSync("scripts/seed-demo-user.ts", "utf8");
    const m = content.match(/process\.env\.DEMO_USER_PASSWORD\s*\|\|\s*["'`](.+?)["'`]/);
    expect(m).toBeTruthy();
    const defaultPass = m![1];
    expect(typeof defaultPass).toBe("string");
    expect(defaultPass.length).toBeGreaterThanOrEqual(8);
    // Also assert canonical value
    expect(defaultPass).toBe("passw0rd");
  });
});
