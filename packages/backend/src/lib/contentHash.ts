/**
 * Content Hashing Utilities
 */
import { createHash } from 'node:crypto';

export function hashContent(content: string): string {
  return Buffer.from(content).toString('base64').substring(0, 32);
}

export function verifyContentHash(content: string, hash: string): boolean {
  return hashContent(content) === hash;
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  const serialize = (current: unknown): string | undefined => {
    if (current === null) {
      return 'null';
    }

    if (typeof current === 'bigint') {
      return JSON.stringify(current.toString());
    }

    if (typeof current !== 'object') {
      return JSON.stringify(current);
    }

    if (seen.has(current)) {
      throw new TypeError('Converting circular structure to JSON');
    }

    if (Array.isArray(current)) {
      seen.add(current);
      const serializedItems = current.map((item) => serialize(item) ?? 'null');
      seen.delete(current);
      return `[${serializedItems.join(',')}]`;
    }

    seen.add(current);
    const obj = current as Record<string, unknown>;
    const serializedProps = Object.keys(obj)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => {
        const serializedValue = serialize(obj[key]);
        if (serializedValue === undefined) {
          return null;
        }
        return `${JSON.stringify(key)}:${serializedValue}`;
      })
      .filter((entry): entry is string => entry !== null);
    seen.delete(current);
    return `{${serializedProps.join(',')}}`;
  };

  return serialize(value) ?? 'null';
}

export function hashObject(obj: unknown): string {
  const stable = stableStringify(obj);
  return createHash('sha256').update(stable).digest('hex');
}

export function shortHash(str: string): string {
  return hashObject(str).slice(0, 8);
}
