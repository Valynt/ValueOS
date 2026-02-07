import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const repoRoot = path.resolve(__dirname, "..");
const dockerfiles = [
  "Dockerfile",
  "Dockerfile.build",
  "Dockerfile.optimized",
  "Dockerfile.optimized.agent",
  "Dockerfile.optimized.frontend",
  ".devcontainer/Dockerfile.dev",
  ".devcontainer/Dockerfile.optimized",
];

function readIfExists(relative: string) {
  const p = path.join(repoRoot, relative);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

function extractExposedPorts(content: string) {
  const ex = [] as number[];
  const re = /(^|\n)EXPOSE\s+(\d+)/gim;
  let m;
  while ((m = re.exec(content))) {
    ex.push(Number(m[2]));
  }
  return ex;
}

function extractArgExposeDefaults(content: string) {
  const defs = [] as number[];
  const re = /(^|\n)ARG\s+EXPOSE_PORT(?:=(\d+))?/gim;
  let m;
  while ((m = re.exec(content))) {
    if (m[2]) defs.push(Number(m[2]));
  }
  return defs;
}

function findRepoContextCopies(content: string) {
  const copies: { line: string; ln: number }[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^COPY\s+/i.test(l)) {
      // skip multi-stage copies from other images
      if (/--from=/i.test(l)) continue;
      // heuristics for repo-context copy
      if (
        l.includes(" package.json") ||
        l.includes(" pnpm-lock.yaml") ||
        l.includes(" . ") ||
        l.includes("./") ||
        l.includes("apps/") ||
        l.includes("packages/")
      ) {
        copies.push({ line: l, ln: i + 1 });
      }
    }
  }
  return copies;
}

const config = JSON.parse(fs.readFileSync(path.join(repoRoot, "config", "ports.json"), "utf8"));
const allowedPorts = new Set(
  Object.values(config).flatMap((o: any) =>
    Object.values(o).filter((v: any) => Number.isInteger(v))
  )
);

describe("Dockerfile policy tests", () => {
  it("only EXPOSE ports present in config/ports.json", () => {
    dockerfiles.forEach((df) => {
      const c = readIfExists(df);
      if (!c) return; // skip missing
      const ports = extractExposedPorts(c);
      const args = extractArgExposeDefaults(c);
      const all = ports.concat(args);
      all.forEach((p) => {
        expect(allowedPorts.has(p)).toBe(true);
      });
    });
  });

  it("COPY of repo context must include --chown when applicable", () => {
    dockerfiles.forEach((df) => {
      const c = readIfExists(df);
      if (!c) return;
      const copies = findRepoContextCopies(c);
      copies.forEach((cp) => {
        const hasChown = /--chown=\S+/i.test(cp.line);
        expect(hasChown).toBe(true);
      });
    });
  });
});
