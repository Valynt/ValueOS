/**
 * Browser-compatible shim for Node.js 'crypto' module.
 *
 * Several server-side modules (GuestAccessService, audit-trail, CacheEncryption,
 * SecretAuditLogger, VaultSecretProvider) live inside the frontend source tree
 * and import Node's crypto. Vite externalises Node built-ins in dev mode which
 * causes a runtime throw. This shim provides minimal browser equivalents so the
 * app can boot; the heavy crypto paths (AES-GCM cipher/decipher) are stubs that
 * throw at call-time rather than import-time.
 *
 * Long-term fix: move server-only modules out of apps/ValyntApp/src.
 */

function randomBytes(size: number): Buffer {
  const buf = new Uint8Array(size);
  globalThis.crypto.getRandomValues(buf);
  return Buffer.from(buf);
}

function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

class Hash {
  private data: Uint8Array[] = [];
  constructor(private algorithm: string) {}

  update(input: string | Buffer): this {
    const encoded =
      typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
    this.data.push(encoded);
    return this;
  }

  digest(encoding: "hex" | "base64" = "hex"): string {
    // Synchronous hashing is not possible with Web Crypto.
    // Fall back to a simple FNV-1a for non-security-critical audit hashes
    // that only run in the browser dev environment.
    const all = mergeUint8Arrays(this.data);
    let h = 0x811c9dc5;
    for (let i = 0; i < all.length; i++) {
      h ^= all[i]!;
      h = Math.imul(h, 0x01000193);
    }
    const hex = (h >>> 0).toString(16).padStart(8, "0");
    // Repeat to approximate sha256 length (64 hex chars)
    const fullHex = hex.repeat(8);
    if (encoding === "hex") return fullHex;
    return btoa(fullHex);
  }
}

function mergeUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function createHash(algorithm: string): Hash {
  return new Hash(algorithm);
}

// Stubs for AES-GCM (CacheEncryption) — these are server-only and should
// never actually execute in the browser.  They throw at call-time so the
// import itself doesn't crash.
function createCipheriv(): never {
  throw new Error("createCipheriv is not available in the browser");
}
function createDecipheriv(): never {
  throw new Error("createDecipheriv is not available in the browser");
}

const cryptoShim = {
  randomBytes,
  randomUUID,
  createHash,
  createCipheriv,
  createDecipheriv,
};

export { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv };
export default cryptoShim;
