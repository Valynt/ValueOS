import dns from "dns/promises";
import net from "net";

const ALLOWED_HOST_SUFFIXES = [
  ".supabase.co",
  ".yourdomain.com"
];

const BLOCKED_IP_RANGES = [
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "::1",
  "fc00::/7"
];

/**
 * Asserts that a URL is safe for outbound requests
 * Prevents SSRF (Server-Side Request Forgery) attacks
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
    suffix =>
      hostname === suffix.slice(1) ||
      hostname.endsWith(suffix)
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
 * Check if IP address is in private/internal ranges
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  if (ip.includes('.')) {
    return (
      ip.startsWith("127.") ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      (ip.startsWith("172.") && (() => {
        const parts = ip.split('.');
        const second = parseInt(parts[1]);
        return second >= 16 && second <= 31;
      })())
    );
  }

  // IPv6 private ranges
  if (ip.includes(':')) {
    return (
      ip.startsWith("fc00:") ||
      ip.startsWith("fe80:") ||
      ip === "::1"
    );
  }

  return false;
}

/**
 * Validate URL without DNS resolution (faster but less secure)
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
    suffix =>
      hostname === suffix.slice(1) ||
      hostname.endsWith(suffix)
  );

  if (!allowed) {
    throw new Error("Hostname not allowed");
  }

  return url;
}