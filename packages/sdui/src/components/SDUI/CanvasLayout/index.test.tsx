import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { DashboardPanel, Grid, HorizontalSplit, VerticalSplit } from "./index";

describe("CanvasLayout primitives", () => {
  it("renders vertical split with ratios snapshot", () => {
    render(
      <VerticalSplit ratios={[2, 1]} gap={12}>
        <div>Left</div>
        <div>Right</div>
      </VerticalSplit>
    );

    expect(screen.getByTestId("canvas-vertical-split").outerHTML).toMatchInlineSnapshot(
      `"<div data-testid=\"canvas-vertical-split\" class=\"grid w-full \" style=\"grid-template-columns: 2fr 1fr; gap: 12px;\"><div class=\"min-h-0 min-w-0\"><div>Left</div></div><div class=\"min-h-0 min-w-0\"><div>Right</div></div></div>"`
    );
  });

  it("renders horizontal split with optional drag resize control", () => {
    render(
      <HorizontalSplit ratios={[1, 1]} resize={{ enabled: true, minRatio: 0.5 }}>
        <div>Top</div>
        <div>Bottom</div>
      </HorizontalSplit>
    );

    const split = screen.getByTestId("canvas-horizontal-split");
    const resizer = screen.getByTestId("split-resizer-0");

    expect(split).toBeInTheDocument();
    expect(resizer).toBeInTheDocument();

    const initialTemplate = split.style.gridTemplateRows;
    fireEvent.mouseDown(resizer, { clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 140 });
    fireEvent.mouseUp(window);

    expect(split.style.gridTemplateRows).not.toEqual(initialTemplate);
  });

  it("collapses grid to one column at responsive breakpoint", () => {
    window.innerWidth = 600;

    render(
      <Grid columns={3} responsive={{ collapseAt: "md", minColumnWidth: 280 }}>
        <div>A</div>
        <div>B</div>
      </Grid>
    );

    const grid = screen.getByTestId("canvas-grid");
    fireEvent(window, new Event("resize"));

    expect(grid).toHaveStyle({ gridTemplateColumns: "1fr" });
  });

  it("toggles dashboard panel content when collapsible", () => {
    render(
      <DashboardPanel title="KPIs" subtitle="Weekly" collapsible>
        <div>Panel Content</div>
      </DashboardPanel>
    );

    expect(screen.getByText("Panel Content")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Panel Content")).not.toBeInTheDocument();
  });
});
