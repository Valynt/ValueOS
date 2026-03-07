import { createHash } from "node:crypto";

import { canonicalizePersistedValue } from "./canonicalizePersistedValue";

export const snapshotHash = (value: unknown): string => {
  const canonicalized = canonicalizePersistedValue(value);
  const digest = createHash("sha256");
  digest.update(JSON.stringify(canonicalized));
  return digest.digest("hex");
};
