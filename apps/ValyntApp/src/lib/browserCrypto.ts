/**
 * Browser-safe crypto helpers for the ValyntApp runtime.
 *
 * Uses Web Crypto for entropy/UUIDs and a deterministic FNV-1a hash for
 * lightweight client-side integrity tagging. Server-grade hashing belongs in
 * packages/backend.
 */

const encoder = new TextEncoder();

export function createBrowserUuid(): string {
  return globalThis.crypto.randomUUID();
}

export function createRandomToken(byteLength: number = 32): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createDeterministicHash(input: string): string {
  const bytes = encoder.encode(input);
  let hash = 0x811c9dc5;

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }

  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return hex.repeat(8);
}
