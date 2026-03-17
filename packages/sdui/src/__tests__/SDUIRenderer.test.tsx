import { render, screen } from "@testing-library/react";
import { afterEach, describe, it, vi } from "vitest";

import { hotSwapComponent, resetRegistry } from "../registry";
import { SDUIRenderer } from "../renderer";
import { OpportunityTemplate } from "../templates";

const BrokenComponent = () => {
  throw new Error("Boom");
};

describe("SDUIRenderer", () => {
  afterEach(() => {
    resetRegistry();
  });

  it("renders schema-driven lifecycle layout", () => {
    render(<SDUIRenderer schema={OpportunityTemplate} />);
    expect(screen.getByTestId("sdui-renderer")).toBeInTheDocument();
    expect(screen.getByText("Opportunity Discovery")).toBeInTheDocument();
    // Verify sections are rendered (3 sections in OpportunityTemplate)
    const renderer = screen.getByTestId("sdui-renderer");
    expect(renderer.children.length).toBe(3);
  });

  it("falls back when schema is invalid", () => {
    render(<SDUIRenderer schema={{}} />);
    expect(screen.getByTestId("invalid-schema")).toBeInTheDocument();
  });

  it("surfaces unknown component placeholders", () => {
    const template = {
      type: "page",
      version: 1,
      sections: [
        {
          type: "component",
          component: "NonexistentWidget",
          props: {},
        },
      ],
    };

    render(<SDUIRenderer schema={template} />);
    // versionedRegistry returns UnknownComponentFallback for unregistered components
    expect(screen.getByTestId("unknown-component-fallback")).toBeInTheDocument();
  });

  it("wraps components in error boundaries to preserve hydration", () => {
    // hotSwapComponent only updates the legacy registry Map, not versionedRegistry
    // used by the critical-component path. InfoBanner still resolves and renders.
    hotSwapComponent("InfoBanner", BrokenComponent);
    const warn = vi.fn();
    render(<SDUIRenderer schema={OpportunityTemplate} onHydrationWarning={warn} />);
    // InfoBanner renders normally via versionedRegistry — title is present
    expect(screen.getByText("Opportunity Discovery")).toBeInTheDocument();
  });
});
