import { snapshotHash } from "./snapshotHash";

export interface TestNamespaceOptions {
  maxLength?: number;
  prefix?: string;
  salt?: string;
}

const sanitizeSegment = (segment: string): string =>
  segment
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const testNamespace = (
  segments: string[],
  options: TestNamespaceOptions = {},
): string => {
  const prefix = sanitizeSegment(options.prefix ?? "test");
  const payload = segments
    .map((segment) => sanitizeSegment(segment))
    .filter((segment) => segment.length > 0)
    .join("-");

  const hashSeed = options.salt ?? process.env.VITEST_WORKER_ID ?? "default";
  const suffix = snapshotHash([payload, hashSeed]).slice(0, 8);
  const namespace = [prefix, payload || "case", suffix].join("-");
  const maxLength = options.maxLength ?? 63;

  if (namespace.length <= maxLength) {
    return namespace;
  }

  const reserved = prefix.length + suffix.length + 2;
  const maxPayloadLength = Math.max(1, maxLength - reserved);
  return [prefix, payload.slice(0, maxPayloadLength), suffix].join("-");
};
