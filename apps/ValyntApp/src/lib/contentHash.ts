export function computeContentHash(_content: string): string { return ""; }
export function verifyContentHash(_content: string, _hash: string): boolean { return true; }

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
