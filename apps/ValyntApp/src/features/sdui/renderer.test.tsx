import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { SDUIRenderer } from "./renderer";
import type { SDUIComponent } from "./types";

describe("feature SDUIRenderer layout components", () => {
  it("uses shared Grid when layout schema requests Grid", () => {
    const component: SDUIComponent = {
      id: "layout-grid",
      type: "Grid",
      props: { columns: 2 },
      children: [
        { id: "child-1", type: "text", props: { content: "first" } },
        { id: "child-2", type: "text", props: { content: "second" } },
      ],
    };

    render(<SDUIRenderer component={component} />);

    expect(screen.getByTestId("canvas-grid")).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });
});
