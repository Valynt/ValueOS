import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DOC_PATH = path.join(ROOT, "docs/codebase-map.md");
const WORKSPACE_PATH = path.join(ROOT, "pnpm-workspace.yaml");
const APPS_DIR = path.join(ROOT, "apps");

function readLines(filePath) {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/);
}

function parseWorkspaceAppPatterns() {
  const lines = readLines(WORKSPACE_PATH);
  const patterns = [];

  for (const line of lines) {
    const match = line.match(/^\s*-\s*"([^"]+)"\s*$/);
    if (!match) continue;
    const pattern = match[1];
    if (pattern.startsWith("apps/")) {
      patterns.push(pattern);
    }
  }

  return patterns;
}

function listAppDirectories() {
  if (!fs.existsSync(APPS_DIR)) return [];
  return fs
    .readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function isWorkspaceIncluded(appName, workspacePatterns) {
  const appPath = `apps/${appName}`;
  return workspacePatterns.some((pattern) => {
    if (pattern === "apps/*") return true;
    if (!pattern.includes("*")) {
      return pattern === appPath;
    }
    return false;
  });
}

function parseDeclaredAppsFromDoc() {
  const lines = readLines(DOC_PATH);
  const sectionStart = lines.findIndex((line) => /^##\s+apps\//i.test(line));
  if (sectionStart === -1) {
    throw new Error(`Could not find apps section in ${path.relative(ROOT, DOC_PATH)}.`);
  }

  let sectionEnd = lines.length;
  for (let index = sectionStart + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      sectionEnd = index;
      break;
    }
  }

  const declaredApps = [];
  for (const line of lines.slice(sectionStart, sectionEnd)) {
    const match = line.match(/^\|\s*`([^`/]+)\/`\s*\|/);
    if (match) {
      declaredApps.push(match[1]);
    }
  }

  if (declaredApps.length === 0) {
    throw new Error(`No app table entries found in ${path.relative(ROOT, DOC_PATH)} apps section.`);
  }

  return declaredApps.sort((a, b) => a.localeCompare(b));
}

const workspacePatterns = parseWorkspaceAppPatterns();
const appDirectories = listAppDirectories();
const documentedApps = parseDeclaredAppsFromDoc();

const errors = [];

if (workspacePatterns.length === 0) {
  errors.push(`No apps/* patterns found in ${path.relative(ROOT, WORKSPACE_PATH)}.`);
}

const workspaceMissingApps = appDirectories.filter((appName) => !isWorkspaceIncluded(appName, workspacePatterns));
if (workspaceMissingApps.length > 0) {
  errors.push(
    `Workspace config is missing app directories: ${workspaceMissingApps.map((app) => `apps/${app}`).join(", ")}.`,
  );
}

const missingInDocs = appDirectories.filter((appName) => !documentedApps.includes(appName));
if (missingInDocs.length > 0) {
  errors.push(`docs/codebase-map.md is missing apps: ${missingInDocs.join(", ")}.`);
}

const staleInDocs = documentedApps.filter((appName) => !appDirectories.includes(appName));
if (staleInDocs.length > 0) {
  errors.push(`docs/codebase-map.md lists apps that are not present under apps/: ${staleInDocs.join(", ")}.`);
}

if (errors.length > 0) {
  console.error("❌ Docs/workspace topology drift detected.");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("✅ Docs/workspace topology check passed.");
console.log(`- Workspace app patterns: ${workspacePatterns.join(", ")}`);
console.log(`- apps/ directories: ${appDirectories.join(", ")}`);
console.log(`- Documented apps: ${documentedApps.join(", ")}`);
