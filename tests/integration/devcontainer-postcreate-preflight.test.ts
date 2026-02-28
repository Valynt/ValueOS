import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("Devcontainer post-create preflight", () => {
  const scriptPath = path.join(process.cwd(), ".devcontainer", "scripts", "post-create.sh");
  it("post-create.sh contains strict workspace preflight checks", () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
    const content = fs.readFileSync(scriptPath, "utf8");

    // Key preflight assertions that must be present and fail loudly
    expect(content).toMatch(/if \[ ! -d \"\$WORKSPACE_FOLDER\" \]; then/);
    expect(content).toMatch(/die \"Workspace not found: \$WORKSPACE_FOLDER\"/);
    expect(content).toMatch(/if \[ ! -d \"\.git\" \]; then/);
    expect(content).toMatch(/die \"Missing \.git in workspace/);
    expect(content).toMatch(/if \[ ! -d \"\.devcontainer\/scripts\" \]; then/);
    expect(content).toMatch(/die \"Missing \.devcontainer\/scripts in workspace/);

    // Ensure preflight appears before workspace-dependent actions (pnpm install)
    const preflightIndex = content.search(/if \[ ! -d \"\$WORKSPACE_FOLDER\" \]; then/);
    const pnpmIndex = content.search(/pnpm install/);
    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    expect(pnpmIndex).toBeGreaterThan(preflightIndex);
  });
});
