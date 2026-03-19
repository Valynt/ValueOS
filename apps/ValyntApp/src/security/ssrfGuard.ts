function isPrivateIp(ip: string): boolean {
  // Handle IPv4-mapped IPv6 addresses in all valid forms:
  //   - Dotted-quad:  ::ffff:127.0.0.1
  //   - Hex compact:  ::ffff:7f00:1
  //   - Full form:    0:0:0:0:0:ffff:7f00:1
  const extractedIpv4 = extractIpv4FromMappedIpv6(ip);
  if (extractedIpv4 !== null) {
    return isPrivateIpv4(extractedIpv4);
  }

  // IPv4 ranges
  if (ip.includes(".") && !ip.includes(":")) {
    return isPrivateIpv4(ip);
  }

  // IPv6 ranges — normalize first
  if (ip.includes(":")) {
    const expanded = expandIpv6(ip.toLowerCase());

    // Loopback (::1)
    if (expanded === "0000:0000:0000:0000:0000:0000:0000:0001") return true;

    // Unspecified (::)
    if (expanded === "0000:0000:0000:0000:0000:0000:0000:0000") return true;

    const firstWord = parseInt(expanded.slice(0, 4), 16);

    // ULA — fc00::/7
    if (firstWord >= 0xfc00 && firstWord <= 0xfdff) return true;

    // Link-local — fe80::/10
    if (firstWord >= 0xfe80 && firstWord <= 0xfebf) return true;

    return false;
  }

  return false;
}

/**
 * Extract an IPv4 address from an IPv4-mapped IPv6 address.
 *
 * Handles all valid representations:
 *   - ::ffff:192.168.1.1        (dotted-quad form)
 *   - ::ffff:c0a8:101           (hex compact form)
 *   - 0:0:0:0:0:ffff:c0a8:101  (full expanded form)
 *   - 0000:0000:0000:0000:0000:ffff:c0a8:0101  (zero-padded form)
 *
 * Returns the extracted IPv4 string (e.g., "192.168.1.1") or null if
 * the address is not an IPv4-mapped IPv6 address.
 */
function extractIpv4FromMappedIpv6(ip: string): string | null {
  if (!ip.includes(":")) return null;

  const lower = ip.toLowerCase().trim();

  // Form 1: dotted-quad (::ffff:A.B.C.D)
  const dottedMatch = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedMatch) {
    return dottedMatch[1];
  }

  // Expand :: notation to full 8 groups, then check for ffff mapping
  const groups = expandIpv6(lower);
  if (groups === null || groups.length !== 8) return null;

  // IPv4-mapped IPv6: first 5 groups are 0, 6th group is ffff
  const isIpv4Mapped =
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff;

  if (!isIpv4Mapped) return null;

  // Decode last 32 bits from groups[6] and groups[7] into IPv4 octets
  const hi = groups[6];
  const lo = groups[7];
  const a = (hi >> 8) & 0xff;
  const b = hi & 0xff;
  const c = (lo >> 8) & 0xff;
  const d = lo & 0xff;

  return `${a}.${b}.${c}.${d}`;
}

/**
 * Expand an IPv6 address string into 8 numeric 16-bit groups.
 * Handles :: shorthand expansion. Returns null on invalid input.
 */
function expandIpv6(ip: string): number[] | null {
  // Strip dotted-quad suffix (not handled here for mapped detection;
  // dotted-quad is caught earlier in extractIpv4FromMappedIpv6)
  if (ip.includes(".")) return null;

  let halves: string[];
  if (ip.includes("::")) {
    const parts = ip.split("::");
    if (parts.length !== 2) return null; // multiple :: is invalid
    halves = parts as [string, string];
  } else {
    halves = [ip, ""];
  }

  const left = halves[0] === "" ? [] : halves[0].split(":");
  const right = halves[1] === "" ? [] : halves[1].split(":");

  if (left.length + right.length > 8) return null;

  const fillCount = 8 - left.length - right.length;
  if (ip.includes("::") && fillCount < 0) return null;

  const groups: number[] = [];

  for (const g of left) {
    const val = parseInt(g, 16);
    if (isNaN(val) || val < 0 || val > 0xffff) return null;
    groups.push(val);
  }

  if (ip.includes("::")) {
    for (let i = 0; i < fillCount; i++) {
      groups.push(0);
    }
  }

  for (const g of right) {
    const val = parseInt(g, 16);
    if (isNaN(val) || val < 0 || val > 0xffff) return null;
    groups.push(val);
  }

  return groups.length === 8 ? groups : null;
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
