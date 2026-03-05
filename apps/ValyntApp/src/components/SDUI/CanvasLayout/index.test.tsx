import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { Grid, VerticalSplit } from "./index";

describe("ValyntApp CanvasLayout re-exports", () => {
  it("re-exports shared layout primitives", () => {
    render(
      <VerticalSplit>
        <Grid columns={2} responsive={false}>
          <div>One</div>
          <div>Two</div>
        </Grid>
        <div>Secondary</div>
      </VerticalSplit>
    );

    expect(screen.getByTestId("canvas-vertical-split")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-grid")).toBeInTheDocument();
  });
});
