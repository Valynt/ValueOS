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
  class="w-full grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 "
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

  it("supports dashboard panel collapse behavior", () => {
    render(
      <DashboardPanel title="Pipeline" collapsible>
        <div>Panel Content</div>
      </DashboardPanel>
    );

    expect(screen.getByText("Panel Content")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Panel Content")).not.toBeInTheDocument();
  });

  it("renders split layouts with ratio templates and stack breakpoints", () => {
    const { rerender } = render(
      <VerticalSplit ratios={[1, 2]} stackAt="md">
        <div>Left</div>
        <div>Right</div>
      </VerticalSplit>
    );

    const vertical = screen.getByTestId("canvas-vertical-split");
    expect(vertical.className).toContain("md:grid-cols-[inherit]");
    expect((vertical as HTMLDivElement).style.gridTemplateColumns).toContain("1fr 2fr");

    rerender(
      <HorizontalSplit ratios={[2, 1]} stackAt="lg">
        <div>Top</div>
        <div>Bottom</div>
      </HorizontalSplit>
    );

    const horizontal = screen.getByTestId("canvas-horizontal-split");
    expect(horizontal.className).toContain("lg:grid-rows-[inherit]");
    expect((horizontal as HTMLDivElement).style.gridTemplateRows).toContain("2fr 1fr");
  });
});
