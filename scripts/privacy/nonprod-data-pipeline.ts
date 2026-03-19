import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { sanitizeForLogging } from "../../packages/shared/src/lib/piiFilter.ts";
import {
  NON_PROD_ALLOWED_EMAIL_SUFFIXES,
  NON_PROD_REDACTED_TEXT,
  NON_PROD_REDACTED_VALUE,
  NON_PROD_SENSITIVE_FIELD_NAMES,
  anonymizeNonProductionData,
} from "../../packages/backend/src/lib/anonymization.ts";
import { redactSensitiveData } from "../../packages/backend/src/lib/redaction.ts";

interface PipelineArgs {
  inputPath: string;
  outputDir: string;
  rulesPath: string;
  forbiddenIdentifiersPath?: string;
}

interface RuleResult {
  rule: string;
  description: string;
  status: "pass" | "fail";
  checked: number;
  failures: string[];
}

interface VerificationReport {
  generatedAt: string;
  inputPath: string;
  anonymizedDatasetPath: string;
  scannedFiles: string[];
  rules: RuleResult[];
  overallStatus: "pass" | "fail";
}

interface RulesConfig {
  forbiddenIdentifierHints: string[];
  allowedEmailSuffixes: string[];
  sensitiveFieldPatterns: string[];
}

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function parseArgs(): PipelineArgs {
  const inputPath = getArgValue("--input") ?? "scripts/privacy/fixtures/restored-snapshot.sample.json";
  const outputDir = getArgValue("--output-dir") ?? "artifacts/nonprod-data-privacy";
  const rulesPath = getArgValue("--rules") ?? "scripts/privacy/nonprod-data-rules.json";
  const forbiddenIdentifiersPath = getArgValue("--forbidden-identifiers-file");

  return {
    inputPath,
    outputDir,
    rulesPath,
    forbiddenIdentifiersPath,
  };
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function collectFiles(inputPath: string): Promise<string[]> {
  const inputStats = await stat(inputPath);

  if (inputStats.isFile()) {
    return [inputPath];
  }

  const entries = await readdir(inputPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(inputPath, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(absolute);
      }

      return [absolute];
    }),
  );

  return files.flat().sort();
}

function relativize(filePath: string, rootPath: string): string {
  if (filePath === rootPath) {
    return path.basename(filePath);
  }

  return path.relative(rootPath, filePath) || path.basename(filePath);
}

async function anonymizeInput(inputPath: string, outputDir: string): Promise<string[]> {
  const files = await collectFiles(inputPath);
  const writtenFiles: string[] = [];

  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const relativeName = (await stat(inputPath)).isDirectory()
      ? relativize(file, inputPath)
      : path.basename(file);
    const destination = path.join(outputDir, "anonymized", relativeName);
    await mkdir(path.dirname(destination), { recursive: true });

    if (file.endsWith(".json")) {
      const parsed = JSON.parse(raw) as unknown;
      const anonymized = anonymizeNonProductionData(parsed);
      await writeFile(destination, `${JSON.stringify(anonymized, null, 2)}\n`, "utf8");
    } else {
      const sanitized = sanitizeForLogging(raw);
      await writeFile(destination, `${String(sanitized)}\n`, "utf8");
    }

    writtenFiles.push(destination);
  }

  return writtenFiles;
}

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

async function loadForbiddenIdentifiers(args: PipelineArgs, rules: RulesConfig): Promise<string[]> {
  const values = new Set(rules.forbiddenIdentifierHints.map((value) => value.trim()).filter(Boolean));

  if (!args.forbiddenIdentifiersPath) {
    return Array.from(values);
  }

  const raw = await readFile(args.forbiddenIdentifiersPath, "utf8");
  raw
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => values.add(entry));

  return Array.from(values);
}

function isRedactedValue(value: unknown, allowedEmailSuffixes: string[]): boolean {
  if (value === null) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  if (value === NON_PROD_REDACTED_VALUE || value === NON_PROD_REDACTED_TEXT) {
    return true;
  }

  return allowedEmailSuffixes.some((suffix) => value.endsWith(suffix));
}

function collectSensitiveFieldFailures(
  value: unknown,
  patterns: string[],
  allowedEmailSuffixes: string[],
  currentPath: string = "$",
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectSensitiveFieldFailures(entry, patterns, allowedEmailSuffixes, `${currentPath}[${index}]`),
    );
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  const failures: string[] = [];
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const keyPath = `${currentPath}.${key}`;
    const lowerKey = key.toLowerCase();
    if (patterns.some((pattern) => lowerKey.includes(pattern))) {
      if (Array.isArray(nestedValue) || (typeof nestedValue === "object" && nestedValue !== null)) {
        failures.push(...collectSensitiveFieldFailures(nestedValue, patterns, allowedEmailSuffixes, keyPath));
        continue;
      }

      if (!isRedactedValue(nestedValue, allowedEmailSuffixes)) {
        failures.push(`${keyPath} retained value ${JSON.stringify(redactSensitiveData(nestedValue))}`);
      }
      continue;
    }

    failures.push(...collectSensitiveFieldFailures(nestedValue, patterns, allowedEmailSuffixes, keyPath));
  }

  return failures;
}

function collectRegexFailures(content: string, allowedEmailSuffixes: string[]): string[] {
  const failures: string[] = [];
  const emailMatches = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  for (const match of emailMatches) {
    if (!allowedEmailSuffixes.some((suffix) => match.toLowerCase().endsWith(suffix.toLowerCase()))) {
      failures.push(`Unexpected email literal detected: ${match}`);
    }
  }

  const secretPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g,
    /\b(?:\d[ -]*?){13,19}\b/g,
    /\bBearer\s+[A-Za-z0-9._-]+\b/gi,
  ];
  for (const pattern of secretPatterns) {
    const matches = content.match(pattern) ?? [];
    for (const match of matches) {
      failures.push(`Sensitive literal detected: ${match}`);
    }
  }

  return failures;
}

async function buildVerificationReport(
  args: PipelineArgs,
  anonymizedFiles: string[],
): Promise<VerificationReport> {
  const rules = await readJsonFile<RulesConfig>(args.rulesPath);
  const forbiddenIdentifiers = await loadForbiddenIdentifiers(args, rules);
  const allowedEmailSuffixes = [
    ...new Set([...NON_PROD_ALLOWED_EMAIL_SUFFIXES, ...rules.allowedEmailSuffixes]),
  ];
  const sensitivePatterns = [
    ...new Set([...NON_PROD_SENSITIVE_FIELD_NAMES, ...rules.sensitiveFieldPatterns].map(normalizeToken)),
  ];

  const fileContents = await Promise.all(
    anonymizedFiles.map(async (filePath) => ({
      filePath,
      content: await readFile(filePath, "utf8"),
    })),
  );

  const forbiddenFailures = fileContents.flatMap(({ filePath, content }) =>
    forbiddenIdentifiers
      .filter((identifier) => identifier && content.includes(identifier))
      .map((identifier) => `${filePath}: found forbidden identifier '${identifier}'`),
  );

  const sensitiveFieldFailures = fileContents.flatMap(({ filePath, content }) => {
    if (!filePath.endsWith(".json")) {
      return [];
    }

    const parsed = JSON.parse(content) as unknown;
    return collectSensitiveFieldFailures(parsed, sensitivePatterns, allowedEmailSuffixes).map(
      (failure) => `${filePath}: ${failure}`,
    );
  });

  const regexFailures = fileContents.flatMap(({ filePath, content }) =>
    collectRegexFailures(content, allowedEmailSuffixes).map((failure) => `${filePath}: ${failure}`),
  );

  const ruleResults: RuleResult[] = [
    {
      rule: "forbidden-production-identifiers-absent",
      description: "Confirms representative non-prod snapshots do not retain configured production-only identifiers.",
      status: forbiddenFailures.length === 0 ? "pass" : "fail",
      checked: forbiddenIdentifiers.length,
      failures: forbiddenFailures,
    },
    {
      rule: "sensitive-fields-redacted-or-null",
      description: "Confirms sensitive JSON fields are null, redacted, or replaced with approved anonymized placeholders.",
      status: sensitiveFieldFailures.length === 0 ? "pass" : "fail",
      checked: sensitivePatterns.length,
      failures: sensitiveFieldFailures,
    },
    {
      rule: "raw-sensitive-literals-absent",
      description: "Confirms email, SSN, bearer token, and payment-card patterns are absent from the anonymized artifact set.",
      status: regexFailures.length === 0 ? "pass" : "fail",
      checked: 4,
      failures: regexFailures,
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    inputPath: args.inputPath,
    anonymizedDatasetPath: path.join(args.outputDir, "anonymized"),
    scannedFiles: anonymizedFiles,
    rules: ruleResults,
    overallStatus: ruleResults.every((rule) => rule.status === "pass") ? "pass" : "fail",
  };
}

function renderMarkdownReport(report: VerificationReport): string {
  const lines = [
    "# Non-Production Data Anonymization Verification",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Input path: ${report.inputPath}`,
    `- Anonymized dataset path: ${report.anonymizedDatasetPath}`,
    `- Overall status: **${report.overallStatus.toUpperCase()}**`,
    "",
    "## Files scanned",
    "",
    ...report.scannedFiles.map((filePath) => `- ${filePath}`),
    "",
    "## Rule results",
    "",
  ];

  for (const rule of report.rules) {
    lines.push(`### ${rule.rule}`);
    lines.push(`- Status: **${rule.status.toUpperCase()}**`);
    lines.push(`- Checked: ${rule.checked}`);
    lines.push(`- Description: ${rule.description}`);
    if (rule.failures.length > 0) {
      lines.push("- Failures:");
      lines.push(...rule.failures.map((failure) => `  - ${failure}`));
    } else {
      lines.push("- Failures: none");
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const args = parseArgs();
  await mkdir(args.outputDir, { recursive: true });
  const anonymizedFiles = await anonymizeInput(args.inputPath, args.outputDir);
  const report = await buildVerificationReport(args, anonymizedFiles);

  await writeFile(
    path.join(args.outputDir, "verification-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(args.outputDir, "verification-summary.md"), renderMarkdownReport(report), "utf8");

  if (report.overallStatus !== "pass") {
    process.exitCode = 1;
  }
}

void main();
