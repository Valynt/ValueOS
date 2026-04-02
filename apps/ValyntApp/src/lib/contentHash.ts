export function computeContentHash(_content: string): string {
  throw new Error("computeContentHash is not implemented. Use async sha256() and persist the digest explicitly.");
}

export function verifyContentHash(_content: string, _hash: string): boolean {
  throw new Error("verifyContentHash is not implemented. Compare persisted SHA-256 digests instead.");
}

/**
 * SHA-256 hash — uses Web Crypto API (available in Node 18+ and browsers)
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
