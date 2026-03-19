import dns from "dns/promises";

/**
 * Allowed host suffixes for outbound requests.
 *
 * SECURITY AUDIT (2026-03-18): Removed placeholder ".yourdomain.com" which would
 * have allowed SSRF to arbitrary subdomains if deployed. Add your production
 * domain here when ready (e.g., ".valueos.com").
 */
const ALLOWED_HOST_SUFFIXES = [".supabase.co"];

/**
 * Asserts that a URL is safe for outbound requests.
 * Prevents SSRF (Server-Side Request Forgery) attacks by:
 * 1. Restricting protocols to HTTP/HTTPS
 * 2. Allowlisting hostnames
 * 3. Resolving DNS and blocking private/internal IP addresses
 */
export async function assertSafeUrl(input: string): Promise<URL> {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Unsupported protocol");
  }

  const hostname = url.hostname.toLowerCase();

  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
  );

  if (!allowed) {
    throw new Error("Hostname not allowed");
  }

  const addresses = await dns.lookup(hostname, { all: true });

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error("Private IP resolution blocked");
    }
  }

  return url;
}

/**
 * Check if IP address is in private, internal, or otherwise blocked ranges.
 *
 * Covers: RFC 1918, loopback, link-local, cloud metadata (169.254.169.254),
 * IPv4-mapped IPv6 addresses, and IPv6 ULA/loopback/link-local ranges.
 */
function isPrivateIp(ip: string): boolean {
  // Handle IPv4-mapped IPv6 addresses in any textual form.
  // Matches both compressed (::ffff:127.0.0.1) and expanded
  // (0:0:0:0:0:ffff:127.0.0.1) representations.
  const ipv4MappedMatch = ip.match(/^(?:0*:){0,4}(?:0*:)?(?:0*:ffff|ffff):(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4MappedMatch && ipv4MappedMatch[1]) {
    return isPrivateIpv4(ipv4MappedMatch[1]);
  }

  // IPv4 ranges
  if (ip.includes(".") && !ip.includes(":")) {
    return isPrivateIpv4(ip);
  }

  // IPv6 ranges — normalize first to handle equivalent textual forms
  // (e.g., "0:0:0:0:0:0:0:1" vs "::1", "FE80::1" vs "fe80::1")
  if (ip.includes(":")) {
    const expanded = expandIpv6(ip.toLowerCase());

    // Loopback (::1)
    if (expanded === "0000:0000:0000:0000:0000:0000:0000:0001") return true;

    // Unspecified (::)
    if (expanded === "0000:0000:0000:0000:0000:0000:0000:0000") return true;

    const firstWord = parseInt(expanded.slice(0, 4), 16);

    // Unique Local Address — fc00::/7 (first 7 bits = 1111110x → 0xfc–0xfd)
    if (firstWord >= 0xfc00 && firstWord <= 0xfdff) return true;

    // Link-local — fe80::/10 (first 10 bits = 1111111010 → 0xfe80–0xfebf)
    if (firstWord >= 0xfe80 && firstWord <= 0xfebf) return true;

    return false;
  }

  return false;
}

/**
 * Check if an IPv4 address is in a private/internal range.
 */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;

  const octets = parts.map((p) => parseInt(p, 10));
  if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return false;

  const [first, second] = octets;

  return (
    first === 127 || // 127.0.0.0/8 loopback
    first === 10 || // 10.0.0.0/8 private
    (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12 private
    (first === 192 && second === 168) || // 192.168.0.0/16 private
    first === 0 || // 0.0.0.0/8 "this" network
    (first === 169 && second === 254) || // 169.254.0.0/16 link-local & cloud metadata
    (first === 100 && second >= 64 && second <= 127) // 100.64.0.0/10 CGNAT
  );
}

/**
 * Expand an IPv6 address to its full 8-group, zero-padded form.
 * Handles :: expansion and normalizes each group to 4 hex digits.
 * Input MUST be lowercase. Returns the canonical expanded form
 * (e.g., "fe80::1" → "fe80:0000:0000:0000:0000:0000:0000:0001").
 */
function expandIpv6(ip: string): string {
  // Strip zone ID (e.g., %eth0) if present
  const zoneIdx = ip.indexOf("%");
  const clean = zoneIdx >= 0 ? ip.slice(0, zoneIdx) : ip;

  let groups: string[];

  if (clean.includes("::")) {
    const [left, right] = clean.split("::");
    const leftGroups = left ? left.split(":") : [];
    const rightGroups = right ? right.split(":") : [];
    const missing = 8 - leftGroups.length - rightGroups.length;
    const fill = Array(missing).fill("0000");
    groups = [...leftGroups, ...fill, ...rightGroups];
  } else {
    groups = clean.split(":");
  }

  // Pad each group to 4 hex digits
  return groups.map((g) => g.padStart(4, "0")).join(":");
}

/**
 * Validate URL without DNS resolution (faster but less secure).
 * Use assertSafeUrl for full protection including DNS resolution checks.
 */
export function validateUrlFormat(input: string): URL {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Unsupported protocol");
  }

  const hostname = url.hostname.toLowerCase();

  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
  );

  if (!allowed) {
    throw new Error("Hostname not allowed");
  }

  return url;
}
