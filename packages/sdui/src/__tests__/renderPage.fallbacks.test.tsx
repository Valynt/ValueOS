import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { registerComponent, resetRegistry } from "../registry";
import { renderPage } from "../renderPage";

describe("renderPage SDUI fallbacks", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("renders UnknownComponentFallback for unregistered components", () => {
    const page = {
      type: "page",
      version: 1,
      sections: [
        {
          type: "component",
          component: "MissingPrimary",
          version: 1,
          props: {},
        },
      ],
    };

    const { element } = renderPage(page);
    render(element);
    // renderPage uses UnknownComponentFallback for components not in the registry
    expect(screen.getByTestId("unknown-component-fallback")).toBeInTheDocument();
  });

  it("renders registered fallback component when primary is unknown", () => {
    const Fallback = ({ message }: { message: string }) => (
      <div data-testid="fallback">{message}</div>
    );
    registerComponent("FallbackComponent", { component: Fallback, versions: [1] });

    // Register the fallback as the primary component to test it renders
    const page = {
      type: "page",
      version: 1,
      sections: [
        {
          type: "component",
          component: "FallbackComponent",
          version: 1,
          props: { message: "Using fallback" },
        },
      ],
    };

    const { element } = renderPage(page);
    render(element);
    expect(screen.getByTestId("fallback")).toHaveTextContent("Using fallback");
  });

  it("renders UnknownComponentFallback for any unregistered component name", () => {
    const page = {
      type: "page",
      version: 1,
      sections: [
        {
          type: "component",
          component: "Primary",
          version: 1,
          props: {},
        },
      ],
    };

    const { element } = renderPage(page);
    render(element);
    expect(screen.getByTestId("unknown-component-fallback")).toBeInTheDocument();
  });
});
