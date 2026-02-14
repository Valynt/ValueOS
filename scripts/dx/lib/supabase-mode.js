function normalizeFlag(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

export function extractUrlHost(raw) {
  if (!raw) return "";
  const value = String(raw).trim();
  if (!value) return "";
  try {
    return new URL(value).hostname;
  } catch {
    const withoutProtocol = value.replace(/^https?:\/\//i, "");
    const withoutPath = withoutProtocol.split("/")[0];
    const withoutAuth = withoutPath.split("@").pop();
    return withoutAuth.split(":")[0];
  }
}

export function isLocalHost(host, localHosts = [], networkHosts = []) {
  if (!host) return true;
  const normalized = host.toLowerCase();
  const allowed = new Set(
    [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "host.docker.internal",
      ...localHosts,
      ...networkHosts,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
  );
  return allowed.has(normalized);
}

export function resolveSupabaseMode({ env = process.env, localHosts = [], networkHosts = [] } = {}) {
  const force = normalizeFlag(env.DX_FORCE_SUPABASE);
  const skip = normalizeFlag(env.DX_SKIP_SUPABASE);
  const localFlag = normalizeFlag(env.DX_SUPABASE_LOCAL);
  const explicitMode = env.DX_SUPABASE_MODE ? String(env.DX_SUPABASE_MODE).trim().toLowerCase() : null;

  // Explicit override via DX_SUPABASE_MODE takes highest precedence
  if (explicitMode) {
    if (explicitMode === "local") return { mode: "local", reason: "explicit-mode" };
    if (explicitMode === "cloud") return { mode: "cloud", reason: "explicit-mode" };
    if (explicitMode === "skip") return { mode: "skip", reason: "explicit-mode" };
  }

  if (force === true || localFlag === true) {
    return { mode: "local", reason: "forced" };
  }

  if (skip === true || localFlag === false) {
    return { mode: "skip", reason: "explicit-skip" };
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  if (supabaseUrl) {
    const host = extractUrlHost(supabaseUrl);
    if (!isLocalHost(host, localHosts, networkHosts)) {
      return { mode: "cloud", reason: "remote-url", host };
    }
  }

  return { mode: "local", reason: "default" };
}
