import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveModeEnvFile } from "./env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

const COMPOSE_ROOT = "ops/compose";
const BASE_COMPOSE_FILE = `${COMPOSE_ROOT}/compose.yml`;
const PROFILE_ALIASES = {
  supabase: "supabase",
  obs: "obs",
  observability: "obs",
  tools: "tools",
};

export const ALL_COMPOSE_PROFILES = ["supabase", "obs", "tools"];

const PROFILE_FILES = {
  supabase: `${COMPOSE_ROOT}/profiles/supabase.yml`,
  obs: `${COMPOSE_ROOT}/profiles/observability.yml`,
  tools: `${COMPOSE_ROOT}/profiles/tools.yml`,
};

function normalizeProfile(profile) {
  return PROFILE_ALIASES[String(profile || "").trim().toLowerCase()] || null;
}

export function parseComposeProfiles(args = []) {
  const parsed = [];

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--profile" || token === "--profiles") {
      const value = args[i + 1] || "";
      i += 1;
      value
        .split(",")
        .map((item) => normalizeProfile(item))
        .filter(Boolean)
        .forEach((item) => parsed.push(item));
      continue;
    }

    if (token.startsWith("--profile=") || token.startsWith("--profiles=")) {
      const [, value = ""] = token.split("=", 2);
      value
        .split(",")
        .map((item) => normalizeProfile(item))
        .filter(Boolean)
        .forEach((item) => parsed.push(item));
    }
  }

  const fromEnv = (process.env.DX_PROFILES || "")
    .split(",")
    .map((item) => normalizeProfile(item))
    .filter(Boolean);

  return [...new Set([...parsed, ...fromEnv])];
}

export function resolveComposeProfiles(mode, requested = []) {
  const normalized = [...new Set(requested.map((item) => normalizeProfile(item)).filter(Boolean))];
  if (normalized.length > 0) {
    return normalized;
  }

  if (mode === "docker" || mode === "local") {
    return ["supabase"];
  }

  return [];
}

export function buildComposeArgs({ mode, profiles = [] } = {}) {
  const selectedProfiles = resolveComposeProfiles(mode, profiles);
  const args = [
    "--project-directory",
    projectRoot,
    "--env-file",
    "ops/env/.env.ports",
  ];

  const modeEnvFile = resolveModeEnvFile(mode);
  const relativeModeEnv = path.relative(projectRoot, modeEnvFile);
  if (modeEnvFile && fs.existsSync(modeEnvFile) && relativeModeEnv) {
    args.push("--env-file", relativeModeEnv);
  }

  args.push("-f", BASE_COMPOSE_FILE);

  for (const profile of selectedProfiles) {
    const file = PROFILE_FILES[profile];
    if (file) {
      args.push("-f", file, "--profile", profile === "obs" ? "observability" : profile);
    }
  }

  return { args, profiles: selectedProfiles, files: [BASE_COMPOSE_FILE, ...selectedProfiles.map((p) => PROFILE_FILES[p]).filter(Boolean)] };
}

export function composeCommand(subcommand, { mode, profiles = [], extraArgs = [] } = {}) {
  const assembled = buildComposeArgs({ mode, profiles });
  const command = ["docker", "compose", ...assembled.args, subcommand, ...extraArgs].join(" ");
  return { command, ...assembled };
}
