import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { Hero } from "../Hero";
import { Navigation } from "../Navigation";
import { SkipNav } from "../SkipNav";

describe("Marketing component accessibility", () => {
  it("renders an explicitly-labeled navigation landmark", () => {
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>
    );

    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /valynt home/i }).getAttribute("href")).toBe("/");
    expect(
      screen.getByRole("link", { name: /deploy value operating system/i }).getAttribute("href")
    ).toBe("/signup");
  });

  it("exposes key hero actions with accessible names", () => {
    render(<Hero />);

    expect(screen.getByRole("heading", { level: 1, name: /value, operationalized/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /explore the value os/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /see the valynt engine in action/i })).toBeTruthy();
  });

  it("provides a skip navigation control to main content", () => {
    render(<SkipNav />);

    expect(screen.getByRole("link", { name: /skip to main content/i }).getAttribute("href")).toBe(
      "#main-content"
    );
  });
});
