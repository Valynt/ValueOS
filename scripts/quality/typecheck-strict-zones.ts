import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type StrictZone = {
  name: string;
  project: string;
  description?: string;
};

type StrictZoneConfig = {
  zones: StrictZone[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const strictZonesPath = path.join(repoRoot, ".quality", "strict-zones.json");

const config = JSON.parse(fs.readFileSync(strictZonesPath, "utf8")) as StrictZoneConfig;

for (const zone of config.zones) {
  const projectPath = path.join(repoRoot, zone.project);
  console.log(`🔒 Strict zone: ${zone.name} (${zone.project})`);
  execFileSync("pnpm", ["tsc", "--project", projectPath, "--pretty", "false"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

console.log(`✅ Strict zones passed (${config.zones.length} total).`);
