import { describe, expect, it } from "vitest";

import { canonicalizePersistedValue } from "./canonicalizePersistedValue";

describe("canonicalizePersistedValue", () => {
  it("sorts object keys and removes undefined values", () => {
    const result = canonicalizePersistedValue({
      z: 1,
      a: "first",
      nested: { b: 2, a: 1, ignored: undefined },
      ignored: undefined,
    });

    expect(result).toEqual({
      a: "first",
      nested: { a: 1, b: 2 },
      z: 1,
    });
  });

  it("normalizes maps and sets to deterministic values", () => {
    const value = {
      set: new Set(["b", "a"]),
      map: new Map<string, unknown>([
        ["b", 2],
        ["a", 1],
      ]),
    };

    expect(canonicalizePersistedValue(value)).toEqual({
      map: { a: 1, b: 2 },
      set: ["a", "b"],
    });
  });
});
