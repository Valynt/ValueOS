#!/usr/bin/env node
import fs from "fs";
import path from "path";

const root = path.resolve(new URL(import.meta.url).pathname, "..", "..");
const tokensPath = path.join(root, "src", "tokens", "tokens.json");
const outPath = path.join(root, "src", "css", "tokens.css");

function flattenTokens(obj, prefix = []) {
  const entries = [];
  for (const [k, v] of Object.entries(obj)) {
    const keyParts = [...prefix, k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      entries.push(...flattenTokens(v, keyParts));
    } else {
      const varName = `--vds-${keyParts.join("-")}`;
      entries.push({ name: varName, value: String(v) });
    }
  }
  return entries;
}

function generateCss(tokens) {
  const flat = flattenTokens(tokens);
  const lines = [":root {"];
  for (const e of flat) {
    lines.push(`  ${e.name}: ${e.value};`);
  }
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

async function run() {
  const argv = process.argv.slice(2);
  const verify = argv.includes("--verify");
  if (!fs.existsSync(tokensPath)) {
    console.error("tokens.json not found at", tokensPath);
    process.exit(2);
  }
  const raw = fs.readFileSync(tokensPath, "utf8");
  let tokens;
  try {
    tokens = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse tokens.json:", e.message);
    process.exit(2);
  }
  const css = generateCss(tokens);
  if (verify) {
    if (!fs.existsSync(outPath)) {
      console.error("tokens.css missing, run without --verify to generate it");
      process.exit(1);
    }
    const existing = fs.readFileSync(outPath, "utf8");
    if (existing.trim() !== css.trim()) {
      console.error("tokens.css is out of date. Run the generator to update.");
      process.exit(1);
    }
    console.log("tokens.css is up to date.");
    process.exit(0);
  }
  fs.writeFileSync(outPath, css, "utf8");
  console.log("Wrote", outPath);
}

run();
