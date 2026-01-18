import { crypto } from "@valueos/shared";

/**
 * Utility for hashing objects for integrity checks
 */

export async function hashObject(obj: any): Promise<{ hash: string; size: number }> {
  const str = JSON.stringify(obj);
  const size = str.length;

  // Use a simple hash for tests if crypto is not available in environment
  // In a real environment, this should use crypto.subtle or similar
  let hash = "";
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    // Fallback for Node environments without subtle crypto in older versions
    // or when running in restricted environments
    let h1 = 0xdeadbeef,
      h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    hash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  return { hash, size };
}

export function shortHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}
