/**
 * Content Hashing Utilities
 */

export function hashContent(content: string): string {
  return Buffer.from(content).toString('base64').substring(0, 32);
}

export function verifyContentHash(content: string, hash: string): boolean {
  return hashContent(content) === hash;
}

export function hashObject(obj: unknown): string {
  return JSON.stringify(obj).split("").reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
}
export function shortHash(str: string): string {
  return hashObject(str).slice(0, 8);
}
