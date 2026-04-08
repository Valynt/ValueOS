#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const appRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const srcRoot = path.join(appRoot, "src");

const args = new Set(process.argv.slice(2));
const write = !args.has("--dry-run");

const targetRoots = [
  "src/features/workspace",
  "src/layouts",
  "src/hooks",
].map((p) => path.join(appRoot, p));

const sourceFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    if (entry.name.endsWith(".stories.tsx")) continue;

    sourceFiles.push(fullPath);
  }
}

for (const root of targetRoots) {
  if (fs.existsSync(root)) walk(root);
}

const exportMap = new Map();
let exportFilesChanged = 0;

for (const filePath of sourceFiles) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const exportDefaultIdentifier = sourceText.match(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/);

  if (!exportDefaultIdentifier) continue;

  const [, exportedName] = exportDefaultIdentifier;
  exportMap.set(path.normalize(filePath), exportedName);

  const nextText = sourceText.replace(
    /export\s+default\s+([A-Za-z_$][\w$]*)\s*;/g,
    "export { $1 };"
  );

  if (nextText !== sourceText) {
    exportFilesChanged += 1;
    if (write) fs.writeFileSync(filePath, nextText, "utf8");
  }
}

function resolveModule(importingFile, specifier) {
  const importerDir = path.dirname(importingFile);
  const candidates = [];

  if (specifier.startsWith("@/")) {
    const base = path.join(srcRoot, specifier.slice(2));
    candidates.push(base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx"));
  } else if (specifier.startsWith(".")) {
    const base = path.resolve(importerDir, specifier);
    candidates.push(base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx"));
  } else {
    return null;
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.normalize(candidate);
    }
  }

  return null;
}

const allSrcFiles = [];
(function walkAll(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAll(fullPath);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      allSrcFiles.push(fullPath);
    }
  }
})(srcRoot);

let importFilesChanged = 0;

for (const filePath of allSrcFiles) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sf = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const edits = [];

  for (const node of sf.statements) {
    if (!ts.isImportDeclaration(node) || !node.importClause || !node.moduleSpecifier) continue;

    const defaultImport = node.importClause.name;
    if (!defaultImport) continue;

    if (!ts.isStringLiteral(node.moduleSpecifier)) continue;
    const specifier = node.moduleSpecifier.text;

    const resolved = resolveModule(filePath, specifier);
    if (!resolved) continue;

    const exportedName = exportMap.get(resolved);
    if (!exportedName) continue;

    const namedBindings = node.importClause.namedBindings;
    const existingNamed = [];

    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const el of namedBindings.elements) {
        existingNamed.push(el.getText(sf));
      }
    }

    const defaultLocalName = defaultImport.getText(sf);
    const defaultAsNamed = defaultLocalName === exportedName ? exportedName : `${exportedName} as ${defaultLocalName}`;

    const mergedNamed = [defaultAsNamed, ...existingNamed]
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .join(", ");

    const replacement = `import { ${mergedNamed} } from ${node.moduleSpecifier.getText(sf)};`;

    edits.push({
      start: node.getStart(sf),
      end: node.getEnd(),
      text: replacement,
    });
  }

  if (edits.length === 0) continue;

  let updated = sourceText;
  edits.sort((a, b) => b.start - a.start);
  for (const edit of edits) {
    updated = `${updated.slice(0, edit.start)}${edit.text}${updated.slice(edit.end)}`;
  }

  if (updated !== sourceText) {
    importFilesChanged += 1;
    if (write) fs.writeFileSync(filePath, updated, "utf8");
  }
}

console.log(
  JSON.stringify(
    {
      mode: write ? "write" : "dry-run",
      exportFilesChanged,
      importFilesChanged,
      totalConvertedModules: exportMap.size,
    },
    null,
    2
  )
);
