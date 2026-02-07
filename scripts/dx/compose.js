import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

export const DX_PROFILES = ["supabase", "obs", "tools"];
export const DEFAULT_DX_PROFILES = ["supabase"];

const COMPOSE_FILES = {
  core: "ops/compose/core.yml",
  dev: "ops/compose/dev.yml",
  obs: "ops/compose/observability.yml",
  tools: "ops/compose/tools.yml",
};

export function getProjectRoot() {
  return projectRoot;
}

function normalizeProfiles(profiles) {
  return Array.from(
    new Set(
      profiles
        .flatMap((profile) => String(profile || "").split(","))
        .map((profile) => profile.trim())
        .filter(Boolean)
    )
  );
}

export function resolveDxProfiles(args = [], { env = process.env } = {}) {
  const collected = [];

  args.forEach((arg, index) => {
    if (arg.startsWith("--profile=")) {
      collected.push(arg.split("=")[1]);
    }
    if (arg.startsWith("--profiles=")) {
      collected.push(arg.split("=")[1]);
    }
    if (arg === "--profile" || arg === "--profiles") {
      collected.push(args[index + 1]);
    }
  });

  if (env.DX_PROFILES) {
    collected.push(env.DX_PROFILES);
  }

  const normalized = normalizeProfiles(collected).filter((profile) => DX_PROFILES.includes(profile));
  return normalized.length > 0 ? normalized : DEFAULT_DX_PROFILES;
}

export function getComposeFiles({ mode, profiles }) {
  const files = [mode === "docker" ? COMPOSE_FILES.dev : COMPOSE_FILES.core];
  if (profiles.includes("obs")) {
    files.push(COMPOSE_FILES.obs);
  }
  if (profiles.includes("tools")) {
    files.push(COMPOSE_FILES.tools);
  }
  return files;
}

export function getAllComposeFiles() {
  return Object.values(COMPOSE_FILES);
}

export function buildComposeArgs({ projectDir = projectRoot, files, envFile = ".env.ports" }) {
  const args = ["--project-directory", projectDir, "--env-file", envFile];
  files.forEach((file) => {
    args.push("-f", file);
  });
  return args;
}

export function formatComposeCommand({ projectDir = projectRoot, files, envFile, command }) {
  const args = buildComposeArgs({ projectDir, files, envFile }).join(" ");
  return `docker compose ${args} ${command}`.trim();
}
