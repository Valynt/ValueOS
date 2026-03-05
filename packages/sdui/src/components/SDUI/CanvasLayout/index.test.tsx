import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { DashboardPanel, Grid, HorizontalSplit, VerticalSplit } from "./index";

describe("CanvasLayout primitives", () => {
  it("renders grid with responsive breakpoint classes", () => {
    const { container } = render(
      <Grid columns={3} responsiveColumns={{ base: 1, md: 3, lg: 4 }}>
        <div>A</div>
        <div>B</div>
      </Grid>
    );

    const grid = screen.getByTestId("canvas-grid");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("md:grid-cols-3");
    expect(grid.className).toContain("lg:grid-cols-4");
    expect(container.firstChild).toMatchInlineSnapshot(`
<div
  class="grid w-full grid-cols-1 md:grid-cols-3 lg:grid-cols-4 "
  data-testid="canvas-grid"
  style="gap: 16px;"
>
  <div>
    A
  </div>
  <div>
    B
  </div>
</div>
`);
  });

  it("renders slot-based split children and supports drag resizing", () => {
    render(
      <VerticalSplit dragResize slots={{ primary: <div>Left</div>, secondary: <div>Right</div> }} />
    );

    const split = screen.getByTestId("canvas-vertical-split");
    const separator = screen.getByRole("separator");

    expect(split.className).toContain("md:flex-row");
    expect(screen.getByText("Left")).toBeInTheDocument();
    expect(screen.getByText("Right")).toBeInTheDocument();

    fireEvent.mouseMove(separator, { buttons: 1, clientX: 250, clientY: 0 });
    expect(separator).toHaveStyle({ left: expect.stringContaining("calc(") });
  });

  it("renders horizontal split with responsive stacking class", () => {
    render(
      <HorizontalSplit ratios={[2, 1]} stackAt="lg">
        <div>Top</div>
        <div>Bottom</div>
      </HorizontalSplit>
    );

    const horizontal = screen.getByTestId("canvas-horizontal-split");
    expect(horizontal.className).toContain("lg:flex-col");
  });

  it("supports dashboard panel collapse behavior", () => {
    render(
      <DashboardPanel title="Pipeline" collapsible slots={{ footer: <div>Footer Slot</div> }}>
        <div>Panel Content</div>
      </DashboardPanel>
    );

    expect(screen.getByText("Panel Content")).toBeInTheDocument();
    expect(screen.getByText("Footer Slot")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Panel Content")).not.toBeInTheDocument();
  });
});
