import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "../..");
const portsPath = path.join(projectRoot, "config", "ports.json");

/**
 * Loads and validates port configuration from the central ports.json file.
 * @returns {Object} The validated ports configuration object
 * @throws {Error} If the ports.json file is invalid or contains conflicts
 */
export function loadPorts() {
  const raw = fs.readFileSync(portsPath, "utf8");
  const parsed = JSON.parse(raw);
  validatePorts(parsed);
  console.log("✅ Loaded ports configuration from", portsPath);
  return parsed;
}

/**
 * Validates port configuration for conflicts and valid ranges.
 * @param {Object} ports - The ports configuration object to validate
 * @throws {Error} If ports are invalid or conflicting
 */
function validatePorts(ports) {
  const usedPorts = new Map(); // Map port -> service.key
  const conflicts = [];

  function checkPort(service, portName, portValue) {
    if (typeof portValue !== "number" || !Number.isInteger(portValue)) {
      throw new Error(
        `${service}.${portName} must be an integer, got ${portValue}`
      );
    }
    if (portValue < 1 || portValue > 65535) {
      throw new Error(
        `${service}.${portName} must be between 1-65535, got ${portValue}`
      );
    }
    if (usedPorts.has(portValue)) {
      const existing = usedPorts.get(portValue);
      conflicts.push(
        `${service}.${portName} (${portValue}) conflicts with ${existing}. Set ${service.toUpperCase()}_${portName.toUpperCase()}=<new_port> to override.`
      );
    } else {
      usedPorts.set(portValue, `${service}.${portName}`);
    }
  }

  Object.entries(ports).forEach(([service, config]) => {
    Object.entries(config).forEach(([key, value]) => {
      if (key.includes("Port") || key === "port") {
        checkPort(service, key, value);
      }
    });
  });

  if (conflicts.length > 0) {
    throw new Error(`Port conflicts detected:\n${conflicts.join("\n")}`);
  }
}

/**
 * Resolves a port value with fallback and validation.
 * Prioritizes the provided value over fallback, with warnings for invalid inputs.
 * @param {*} value - The port value to resolve (string, number, or null/undefined)
 * @param {number} fallback - The fallback port number to use if value is invalid
 * @returns {number} The resolved port number
 */
export function resolvePort(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  const trimmed = String(value).trim();
  const parsed = Number(trimmed);

  if (Number.isNaN(parsed)) {
    console.warn(
      `⚠️ Invalid port value "${value}", falling back to ${fallback}`
    );
    return fallback;
  }

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    console.warn(
      `⚠️ Port value "${value}" (${parsed}) is out of valid range (1-65535), falling back to ${fallback}`
    );
    return fallback;
  }

  return parsed;
}

export function formatPortsEnv(ports) {
  return [
    "# ValueOS Port Configuration",
    "# Generated from config/ports.json",
    "",
    "# Database Ports",
    `POSTGRES_PORT=${ports.postgres.port}`,
    `REDIS_PORT=${ports.redis.port}`,
    "",
    "# Application Ports",
    `API_PORT=${ports.backend.port}`,
    `VITE_PORT=${ports.frontend.port}`,
    "",
    "# Supabase Ports (if running locally)",
    `SUPABASE_API_PORT=${ports.supabase.apiPort}`,
    `SUPABASE_STUDIO_PORT=${ports.supabase.studioPort}`,
    "",
    "# Reverse Proxy Ports",
    `CADDY_HTTP_PORT=${ports.edge.httpPort}`,
    `CADDY_HTTPS_PORT=${ports.edge.httpsPort}`,
    `CADDY_ADMIN_PORT=${ports.edge.adminPort}`,
    "",
    "# Observability Ports",
    `PROMETHEUS_PORT=${ports.observability.prometheusPort}`,
    `GRAFANA_PORT=${ports.observability.grafanaPort}`,
    "",
    "# Development Domain",
    "DEV_DOMAIN=localhost",
    "",
    "# Service URLs (auto-configured)",
    `API_UPSTREAM=http://backend:${ports.backend.port}`,
    `FRONTEND_UPSTREAM=http://frontend:80`,
    "",
    "# Logging Configuration",
    "CADDY_LOG_LEVEL=DEBUG",
    "AUTO_HTTPS=off",
    "",
  ].join("\n");
}

export function writePortsEnvFile(
  destination = path.join(projectRoot, ".env.ports")
) {
  const lockFile = `${destination}.lock`;

  // Simple file locking to prevent concurrent writes
  if (fs.existsSync(lockFile)) {
    const lockAge = Date.now() - fs.statSync(lockFile).mtime.getTime();
    if (lockAge > 30000) {
      // 30 seconds timeout
      fs.unlinkSync(lockFile); // Remove stale lock
    } else {
      throw new Error(
        `Port configuration file is locked (${lockFile}). Another process may be writing to it.`
      );
    }
  }

  try {
    fs.writeFileSync(
      lockFile,
      `Locked by PID ${process.pid} at ${new Date().toISOString()}`
    );
    const ports = loadPorts();
    const content = formatPortsEnv(ports);

    // Configuration auditing: log changes
    let changesLogged = false;
    if (fs.existsSync(destination)) {
      const current = fs.readFileSync(destination, "utf8");
      if (current !== content) {
        console.log(" Port configuration updated:");
        const currentLines = current.split("\n");
        const newLines = content.split("\n");
        const maxLines = Math.max(currentLines.length, newLines.length);
        for (let i = 0; i < maxLines; i++) {
          const curr = currentLines[i] || "";
          const nw = newLines[i] || "";
          if (curr !== nw) {
            console.log(`  - ${curr || "(removed)"} → ${nw || "(added)"}`);
            changesLogged = true;
          }
        }
      }
    } else {
      console.log(" Port configuration created");
      changesLogged = true;
    }

    if (!changesLogged) {
      console.log(" Port configuration unchanged");
    }

    fs.writeFileSync(destination, content, "utf8");
    console.log(` Wrote ports env file to ${destination}`);
    return destination;
  } finally {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputPath = writePortsEnvFile();
  console.log(`✅ Wrote ports env file to ${outputPath}`);
}
