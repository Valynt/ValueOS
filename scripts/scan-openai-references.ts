/**
 * Codebase Scanner for OpenAI References
 *
 * Script to scan the codebase for any remaining OpenAI references
 * that should be removed or updated to use Together AI.
 *
 * Usage:
 *   pnpm tsx scripts/scan-openai-references.ts
 */

import * as fs from "fs";
import * as path from "path";

interface ScanResult {
  file: string;
  line: number;
  content: string;
  type: "code" | "comment" | "import" | "config";
}

const OPENAI_PATTERNS = [
  /openai/gi,
  /gpt-[34]/gi,
  /text-embedding-(?:ada|3)/gi,
  /api\.openai\.com/gi,
  /OPENAI_API_KEY/g,
  /['"]openai['"]/gi,
];

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /\.test\./,
  /\.spec\./,
  /scan-openai-references\.ts/, // Exclude this script itself
];

const ALLOWED_IN_COMMENTS = [
  "removed OpenAI",
  "not OpenAI",
  "no longer uses OpenAI",
  "OpenAI has been removed",
  "OpenAI fallback removed",
  "replaced OpenAI",
];

function isExcluded(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function isAllowedComment(line: string): boolean {
  return ALLOWED_IN_COMMENTS.some((allowed) =>
    line.toLowerCase().includes(allowed.toLowerCase())
  );
}

function scanFile(filePath: string): ScanResult[] {
  const results: ScanResult[] = [];

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      OPENAI_PATTERNS.forEach((pattern) => {
        if (pattern.test(line)) {
          // Determine type
          let type: ScanResult["type"] = "code";

          if (line.trim().startsWith("//") || line.trim().startsWith("*")) {
            if (isAllowedComment(line)) {
              return; // Skip allowed comments
            }
            type = "comment";
          } else if (line.includes("import") || line.includes("require")) {
            type = "import";
          } else if (filePath.endsWith(".json") || filePath.endsWith(".env")) {
            type = "config";
          }

          results.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            type,
          });
        }
      });
    });
  } catch (error) {
    // Skip files that can't be read
  }

  return results;
}

function scanDirectory(dir: string): ScanResult[] {
  let results: ScanResult[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (isExcluded(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        results = results.concat(scanDirectory(fullPath));
      } else if (entry.isFile()) {
        // Only scan relevant file types
        if (
          /\.(ts|tsx|js|jsx|json|env|md)$/.test(entry.name) &&
          !entry.name.endsWith(".min.js")
        ) {
          results = results.concat(scanFile(fullPath));
        }
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }

  return results;
}

function generateReport(results: ScanResult[]): string {
  const grouped = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<string, ScanResult[]>
  );

  let report = "# OpenAI References Scan Report\n\n";
  report += `**Total References Found:** ${results.length}\n\n`;

  // Summary by type
  report += "## Summary by Type\n\n";
  Object.entries(grouped).forEach(([type, items]) => {
    report += `- **${type}**: ${items.length} references\n`;
  });
  report += "\n";

  // Detailed results
  Object.entries(grouped).forEach(([type, items]) => {
    report += `## ${type.toUpperCase()} References\n\n`;

    items.forEach((item) => {
      report += `### ${item.file}:${item.line}\n`;
      report += "```\n";
      report += item.content;
      report += "\n```\n\n";
    });
  });

  return report;
}

// Main execution
if (require.main === module) {
  console.log("Scanning for OpenAI references...\n");

  const projectRoot = path.resolve(__dirname, "..");
  const results = scanDirectory(path.join(projectRoot, "src"));

  // Remove duplicates
  const uniqueResults = results.filter(
    (result, index, self) =>
      index ===
      self.findIndex(
        (r) =>
          r.file === result.file &&
          r.line === result.line &&
          r.content === result.content
      )
  );

  console.log(`Found ${uniqueResults.length} OpenAI references\n`);

  // Group by severity
  const critical = uniqueResults.filter((r) => r.type === "code");
  const warnings = uniqueResults.filter((r) => r.type !== "code");

  if (critical.length > 0) {
    console.log(`⚠️  CRITICAL: ${critical.length} code references found`);
    critical.forEach((r) => {
      console.log(`   ${r.file}:${r.line}`);
    });
    console.log("");
  }

  if (warnings.length > 0) {
    console.log(`ℹ️  INFO: ${warnings.length} non-code references found`);
    console.log("");
  }

  // Generate report
  const report = generateReport(uniqueResults);
  const reportPath = path.join(projectRoot, "openai-references-report.md");
  fs.writeFileSync(reportPath, report);

  console.log(`Report saved to: ${reportPath}`);

  // Exit with error code if critical references found
  if (critical.length > 0) {
    console.log("\n❌ Scan failed: Critical OpenAI references found");
    process.exit(1);
  } else {
    console.log("\n✅ Scan passed: No critical OpenAI references");
    process.exit(0);
  }
}

export { scanDirectory, scanFile };
