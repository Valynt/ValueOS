import fs from "fs";
import { execSync } from "child_process";

export function isDevContainer() {
  return (
    process.env.REMOTE_CONTAINERS === "true" ||
    process.env.CODESPACES === "true" ||
    fs.existsSync("/.dockerenv")
  );
}

function parseGatewayFromProcRoute() {
  try {
    const data = fs.readFileSync("/proc/net/route", "utf8");
    const lines = data.trim().split("\n").slice(1);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;
      const destination = parts[1];
      const gatewayHex = parts[2];
      if (destination === "00000000" && gatewayHex && gatewayHex !== "00000000") {
        const bytes = gatewayHex.match(/../g);
        if (!bytes) return null;
        return bytes.reverse().map((b) => Number.parseInt(b, 16)).join(".");
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function resolveDockerHostGateway() {
  if (process.env.DOCKER_HOST_GATEWAY) {
    return process.env.DOCKER_HOST_GATEWAY;
  }

  try {
    const route = execSync("ip route show default", { encoding: "utf8" });
    const match = route.match(/default via ([^ ]+)/);
    if (match) {
      return match[1].trim();
    }
  } catch {
    // ignore and fall through
  }

  const procGateway = parseGatewayFromProcRoute();
  if (procGateway) {
    return procGateway;
  }

  if (isDevContainer()) {
    return "172.17.0.1";
  }

  return null;
}
