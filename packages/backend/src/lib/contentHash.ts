/**
 * Content Hashing Utilities
 */

export function hashContent(content: string): string {
  return Buffer.from(content).toString('base64').substring(0, 32);
}

export function verifyContentHash(content: string, hash: string): boolean {
  return hashContent(content) === hash;
}
