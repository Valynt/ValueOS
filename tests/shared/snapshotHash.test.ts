import { describe, expect, it } from "vitest";

import { snapshotHash } from "./snapshotHash";

describe("snapshotHash", () => {
  it("returns the same hash for equivalent objects with different key order", () => {
    const left = { a: 1, b: { y: 2, x: 1 } };
    const right = { b: { x: 1, y: 2 }, a: 1 };

    expect(snapshotHash(left)).toBe(snapshotHash(right));
  });

  it("returns a different hash when data changes", () => {
    expect(snapshotHash({ value: 1 })).not.toBe(snapshotHash({ value: 2 }));
  });
});
