import { render } from "@testing-library/react";
// @ts-expect-error - no types for jest-axe
import { axe, toHaveNoViolations } from "jest-axe";
import React from "react";
import { describe, expect, it } from "vitest";

import { Button } from "../primitives/Button";
import { Input } from "../primitives/Input";

expect.extend(toHaveNoViolations as any);

describe("a11y", () => {
  it("Button should have no detectable a11y violations", async () => {
    const { container } = render(<Button>Test</Button>);
    const results = await axe(container);
    // @ts-expect-error - jest-axe types don't natively map to vitest's Assertion yet
    expect(results).toHaveNoViolations();
  });

  it("Input should have no detectable a11y violations", async () => {
    const { container } = render(<Input id="t" label="Label" />);
    const results = await axe(container);
    // @ts-expect-error - jest-axe types don't natively map to vitest's Assertion yet
    expect(results).toHaveNoViolations();
  });
});
