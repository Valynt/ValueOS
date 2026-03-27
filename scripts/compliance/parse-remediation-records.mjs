#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const GUIDE_PATH = resolve("docs/security-compliance/compliance-guide.md");
const STATUS_PATH = resolve("docs/security-compliance/control-status.json");

const args = new Set(process.argv.slice(2));
const writeMode = args.has("--write");

const guideText = readFileSync(GUIDE_PATH, "utf8");
const guideLines = guideText.split(/\r?\n/);

const existing = JSON.parse(readFileSync(STATUS_PATH, "utf8"));
const existingControls = Array.isArray(existing.controls) ? existing.controls : [];
const existingById = new Map(existingControls.map((control) => [control.id, control]));

const controls = [];

for (let i = 0; i < guideLines.length; i += 1) {
  const line = guideLines[i];
  if (!line.includes("Remediation Record:")) {
    continue;
  }

  const idMatch = line.match(/`(CR-\d+)`/);
  if (!idMatch) {
    continue;
  }

  const id = idMatch[1];
  const frameworkMatch = line.match(/Framework:\s*([^|]+)/i);
  const ownerMatch = line.match(/Owner:\s*([^|]+)/i);
  const targetDateMatch = line.match(/Target date:\s*([^|]+)/i);
  const statusMatch = line.match(/Status:\s*([^|]+)/i);
  const evidenceMatch = line.match(/Evidence location:\s*`([^`]+)`/i);

  let controlText = "";
  for (let j = i - 1; j >= 0; j -= 1) {
    const candidate = guideLines[j].trim();
    const checklistMatch = candidate.match(/^- \[[ xX]\] (.+)$/);
    if (checklistMatch) {
      controlText = checklistMatch[1].trim();
      break;
    }
    if (candidate.startsWith("## ") || candidate.startsWith("### ")) {
      break;
    }
  }

  let section = "";
  for (let j = i - 1; j >= 0; j -= 1) {
    const candidate = guideLines[j].trim();
    if (candidate.startsWith("## ") || candidate.startsWith("### ")) {
      section = candidate.replace(/^#+\s*/, "");
      break;
    }
  }

  const existingControl = existingById.get(id) ?? {};
  controls.push({
    ...existingControl,
    id,
    control: controlText || existingControl.control || "",
    frameworks: frameworkMatch
      ? frameworkMatch[1].split("/").map((item) => item.trim()).filter(Boolean)
      : Array.isArray(existingControl.frameworks)
        ? existingControl.frameworks
        : [],
    status: statusMatch ? statusMatch[1].trim().toLowerCase() : existingControl.status,
    owner: ownerMatch ? ownerMatch[1].trim() : existingControl.owner,
    targetDate: targetDateMatch ? targetDateMatch[1].trim() : existingControl.targetDate,
    evidenceLocation: evidenceMatch ? evidenceMatch[1].trim() : existingControl.evidenceLocation,
    source: {
      file: "docs/security-compliance/compliance-guide.md",
      line: i + 1,
      section,
    },
  });
}

controls.sort((a, b) => a.id.localeCompare(b.id));

const output = {
  ...existing,
  version: 1,
  generatedFrom: "docs/security-compliance/compliance-guide.md#remediation-records",
  lastUpdated: new Date().toISOString().slice(0, 10),
  controls,
};

if (writeMode) {
  writeFileSync(STATUS_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Updated ${STATUS_PATH} with ${controls.length} remediation records.`);
} else {
  console.log(JSON.stringify(output, null, 2));
}
