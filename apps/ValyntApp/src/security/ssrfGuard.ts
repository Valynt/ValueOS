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
  // Handle IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
  const ipv4MappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4MappedMatch) {
    return isPrivateIpv4(ipv4MappedMatch[1]);
  }

  // IPv4 ranges
  if (ip.includes(".") && !ip.includes(":")) {
    return isPrivateIpv4(ip);
  }

  // IPv6 ranges
  if (ip.includes(":")) {
    const normalized = ip.toLowerCase();
    return (
      normalized === "::1" || // loopback
      normalized === "::" || // unspecified
      normalized.startsWith("fc00:") || // unique local (fc00::/7 lower half)
      normalized.startsWith("fd") || // unique local (fc00::/7 upper half, fd00::/8)
      normalized.startsWith("fe80:") // link-local
    );
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
