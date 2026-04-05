import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

const currentFilePath = fileURLToPath(import.meta.url);
const testsDirectoryPath = path.dirname(currentFilePath);
const sourceDirectoryPath = path.resolve(testsDirectoryPath, "..");
const serverFilePath = path.resolve(sourceDirectoryPath, "server.ts");

const extractInlineScripts = (fileContent: string): string[] => {
  const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
  const scripts: string[] = [];
  let match = scriptRegex.exec(fileContent);

  while (match) {
    scripts.push(match[1]);
    match = scriptRegex.exec(fileContent);
  }

  return scripts;
};

describe("inline browser scripts", () => {
  it("do not reference undefined globals", () => {
    const serverSource = readFileSync(serverFilePath, "utf-8");
    const inlineScripts = extractInlineScripts(serverSource);
    const linter = new Linter();

    const lintMessages = inlineScripts.flatMap((script, index) =>
      linter.verify(
        script,
        {
          parserOptions: {
            ecmaVersion: "latest",
            sourceType: "script",
          },
          env: {
            browser: true,
            es2022: true,
          },
          globals: {
            safeClearElement: "readonly",
            safeCreateJobRow: "readonly",
            safeCreateOptimizationCard: "readonly",
            safeSetPlaceholder: "readonly",
          },
          rules: {
            "no-undef": "error",
          },
        },
        `dashboard-inline-script-${index}.js`,
      ),
    );

    expect(lintMessages).toEqual([]);
  });
});
