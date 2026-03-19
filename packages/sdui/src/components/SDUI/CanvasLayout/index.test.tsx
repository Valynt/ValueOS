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
    expect(separator.style.left).toContain("calc(");
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

  it("renders non-responsive grid with fixed template columns", () => {
    render(
      <Grid columns={4} responsive={false} rows={2}>
        <div>A</div>
      </Grid>
    );

    const grid = screen.getByTestId("canvas-grid") as HTMLDivElement;
    expect(grid.style.gridTemplateColumns).toContain("repeat(4");
    expect(grid.style.gridTemplateRows).toContain("repeat(2");
  });

  it("updates split ratio when drag-resize is enabled", () => {
    const addListenerSpy = vi.spyOn(window, "addEventListener");
    const removeListenerSpy = vi.spyOn(window, "removeEventListener");

    render(
      <VerticalSplit ratios={[1, 1]} dragResize minRatio={0.25}>
        <div>Left</div>
        <div>Right</div>
      </VerticalSplit>
    );

    const split = screen.getByTestId("canvas-vertical-split") as HTMLDivElement;
    vi.spyOn(split, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 1000, height: 600,
      top: 0, left: 0, bottom: 600, right: 1000,
      toJSON: () => ({}),
    });

    const separator = screen.getByRole("separator");

    fireEvent.mouseDown(separator, { clientX: 800, clientY: 100 });
    expect(split.style.gridTemplateColumns).not.toBe("1fr 1fr");

    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    expect(split.style.gridTemplateColumns).toContain("0.25fr 0.75fr");

    fireEvent.mouseUp(window);
    expect(addListenerSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(removeListenerSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));

    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });
});
