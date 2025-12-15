import { ESLint } from "eslint";
import fs from "fs";
import path from "path";

async function main() {
  const eslint = new ESLint({ extensions: [".ts", ".tsx", ".js", ".jsx"] });
  const results = await eslint.lintFiles(["."]);

  let totalErrors = 0;
  let totalWarnings = 0;
  const ruleCounts: Record<string, number> = {};
  const fileRuleCounts: Record<string, Record<string, number>> = {};

  for (const r of results) {
    totalErrors += r.errorCount;
    totalWarnings += r.warningCount;
    for (const m of r.messages) {
      const ruleId = m.ruleId || "unknown";
      ruleCounts[ruleId] = (ruleCounts[ruleId] || 0) + 1;
      fileRuleCounts[r.filePath] = fileRuleCounts[r.filePath] || {};
      fileRuleCounts[r.filePath][ruleId] =
        (fileRuleCounts[r.filePath][ruleId] || 0) + 1;
    }
  }

  const topFilesForRule = (rule: string, top = 20) => {
    const arr = Object.entries(fileRuleCounts)
      .map(([file, rules]) => ({ file, count: rules[rule] || 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, top);
    return arr;
  };

  const summary = {
    totalErrors,
    totalWarnings,
    ruleCounts,
    topAnyFiles: topFilesForRule("@typescript-eslint/no-explicit-any", 30),
    topUnusedVarsFiles: topFilesForRule(
      "@typescript-eslint/no-unused-vars",
      30,
    ),
    topA11yFiles: Object.keys(ruleCounts)
      .filter((r) => r && r.startsWith("jsx-a11y/"))
      .reduce((acc: Record<string, any>, r) => {
        acc[r] = topFilesForRule(r, 20);
        return acc;
      }, {}),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
