import { describe, expect, it } from "vitest";
import { CreateInitiativeSchema } from "../types.js"

describe("Initiatives validation", () => {
  it("normalizes fields and rejects unknown keys", () => {
    const result = CreateInitiativeSchema.safeParse({
      name: "  Launch Plan ",
      ownerEmail: "Owner@Example.com",
      tags: ["  Priority "],
      extraField: "nope",
    });

    expect(result.success).toBe(false);
  });

  it("lowercases emails and tags", () => {
    const parsed = CreateInitiativeSchema.parse({
      name: "Launch Plan",
      ownerEmail: "Owner@Example.com",
      tags: ["  Priority "],
    });

    expect(parsed.ownerEmail).toBe("owner@example.com");
    expect(parsed.tags).toEqual(["priority"]);
  });
});
