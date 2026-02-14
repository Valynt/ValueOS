import fs from "fs";
import path from "path";
import { config } from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");
const opsEnvDir = path.join(projectRoot, "ops", "env");

const MODE_ENV_FILES = {
  local: path.join(opsEnvDir, ".env.local"),
  docker: path.join(opsEnvDir, ".env.docker"),
};

const PORTS_ENV_FILE = path.join(opsEnvDir, ".env.ports");

export function resolveModeEnvFile(mode = "local") {
  return MODE_ENV_FILES[mode] || MODE_ENV_FILES.local;
}

export function resolveEnvLoadOrder(mode = "local") {
  const modeFile = resolveModeEnvFile(mode);
  const files = [PORTS_ENV_FILE, modeFile];
  return files.filter((file, index) => files.indexOf(file) === index);
}

export function loadDxEnv(mode = "local", options = {}) {
  const { override = false } = options;
  const loadedFiles = [];

  for (const envFile of resolveEnvLoadOrder(mode)) {
    if (!fs.existsSync(envFile)) {
      continue;
    }
    config({ path: envFile, override });
    loadedFiles.push(envFile);
  }

  return loadedFiles;
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

export function validateDxEnv(mode = "local") {
  const modeFile = resolveModeEnvFile(mode);
  const errors = [];

  if (!fs.existsSync(modeFile)) {
    errors.push(
      `Missing ${path.relative(projectRoot, modeFile)}. Copy ops/env/.env.local.example and fill required values first.`
    );
    return errors;
  }

  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "API_PORT",
    "VITE_PORT",
    "CORS_ALLOWED_ORIGINS",
  ];

  for (const key of required) {
    const value = process.env[key];
    if (!value || !String(value).trim()) {
      errors.push(`Missing ${key}. Add ${key}=... to ${path.relative(projectRoot, modeFile)}.`);
    }
  }

  if (isTruthy(process.env.ENABLE_REDIS_LOCAL) && !process.env.REDIS_URL) {
    errors.push(
      `ENABLE_REDIS_LOCAL is true but REDIS_URL is not set. Add REDIS_URL=redis://... to ${path.relative(projectRoot, modeFile)}.`
    );
  }

  if (isTruthy(process.env.ENABLE_NATS_LOCAL) && !process.env.NATS_URL) {
    errors.push(
      `ENABLE_NATS_LOCAL is true but NATS_URL is not set. Add NATS_URL=nats://... to ${path.relative(projectRoot, modeFile)}.`
    );
  }

  return errors;
}
