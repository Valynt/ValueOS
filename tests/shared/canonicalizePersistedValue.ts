export type CanonicalPersistedValue =
  | null
  | string
  | number
  | boolean
  | CanonicalPersistedValue[]
  | { [key: string]: CanonicalPersistedValue };

const toStableString = (value: unknown): string => JSON.stringify(value);

export const canonicalizePersistedValue = (
  value: unknown,
): CanonicalPersistedValue => {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return String(value);
    }

    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizePersistedValue(entry));
  }

  if (value instanceof Set) {
    const entries = [...value].map((entry) => canonicalizePersistedValue(entry));
    return entries.sort((a, b) =>
      toStableString(a).localeCompare(toStableString(b)),
    );
  }

  if (value instanceof Map) {
    const mappedObject = Object.fromEntries(
      [...value.entries()].map(([key, entry]) => [
        String(key),
        canonicalizePersistedValue(entry),
      ]),
    );
    return canonicalizePersistedValue(mappedObject);
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const orderedEntries = Object.entries(objectValue)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizePersistedValue(entry)] as const);

    return Object.fromEntries(orderedEntries);
  }

  return String(value);
};
