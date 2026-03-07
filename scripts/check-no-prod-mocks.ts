import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export interface MockViolation {
  file: string;
  line: number;
  snippet: string;
}

const SOURCE_ROOTS = ["apps", "packages", "server", "client", "shared"];
const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const EXCLUDED_PATH_PATTERN = /(^|\/)(tests?|__tests__|mocks?|fixtures?|scripts)(\/|$)|\.test\.|\.spec\./;
const IMPORT_MOCK_PATTERN = /(from\s+["'][^"']*\bmocks?\b[^"']*["'])|(import\s*\(["'][^"']*\bmocks?\b[^"']*["']\))/;

const collectSourceFiles = (root: string): string[] => {
  const stack = [root];
  const collected: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (!statSync(current).isDirectory()) {
      continue;
    }

    for (const entry of readdirSync(current)) {
      const absolutePath = join(current, entry);
      const entryStats = statSync(absolutePath);

      if (entryStats.isDirectory()) {
        if (!EXCLUDED_PATH_PATTERN.test(absolutePath)) {
          stack.push(absolutePath);
        }
        continue;
      }

      if (SOURCE_FILE_PATTERN.test(absolutePath)) {
        collected.push(absolutePath);
      }
    }
  }

  return collected;
};

export const checkNoProdMocks = (
  repositoryRoot: string = process.cwd(),
): MockViolation[] => {
  const files = SOURCE_ROOTS.flatMap((directory) => {
    const absoluteDirectory = join(repositoryRoot, directory);

    try {
      return collectSourceFiles(absoluteDirectory);
    } catch {
      return [];
    }
  });

  const violations: MockViolation[] = [];

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (IMPORT_MOCK_PATTERN.test(line)) {
        violations.push({
          file: relative(repositoryRoot, filePath),
          line: index + 1,
          snippet: line.trim(),
        });
      }
    });
  }

  return violations;
};

const runAsScript = (): void => {
  const violations = checkNoProdMocks();

  if (violations.length === 0) {
    console.log("No production mock imports found.");
    return;
  }

  console.error("Found production mock imports:");
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} -> ${violation.snippet}`,
    );
  }

  process.exitCode = 1;
};

const entryFile = process.argv[1] ? fileURLToPath(import.meta.url) : "";
if (process.argv[1] && process.argv[1] === entryFile) {
  runAsScript();
}
