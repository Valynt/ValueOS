import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { checkNoProdMocks } from "./check-no-prod-mocks";

describe("checkNoProdMocks", () => {
  it("detects mock imports in production source directories", () => {
    const root = mkdtempSync(join(tmpdir(), "check-no-prod-mocks-"));
    mkdirSync(join(root, "apps", "demo", "src"), { recursive: true });
    writeFileSync(
      join(root, "apps", "demo", "src", "index.ts"),
      'import data from "../../tests/mocks/user";\n',
    );

    const violations = checkNoProdMocks(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toContain("apps/demo/src/index.ts");
  });

  it("ignores test files and test directories", () => {
    const root = mkdtempSync(join(tmpdir(), "check-no-prod-mocks-"));
    mkdirSync(join(root, "apps", "demo", "tests"), { recursive: true });
    writeFileSync(
      join(root, "apps", "demo", "tests", "index.test.ts"),
      'import data from "../mocks/user";\n',
    );

    const violations = checkNoProdMocks(root);
    expect(violations).toHaveLength(0);
  });
});
