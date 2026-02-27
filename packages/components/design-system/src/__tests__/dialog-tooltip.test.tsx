import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../primitives/Dialog";
import { Tooltip } from "../primitives/Tooltip";

describe("Dialog keyboard and focus", () => {
  it("closes on Escape and returns focus to opener", () => {
    const onClose = vi.fn();
    const { getByText, rerender } = render(
      <div>
        <button>Opener</button>
        <Dialog open={true} title="Test" onClose={onClose}>
          <button>Inside</button>
        </Dialog>
      </div>
    );
    const inside = getByText("Inside");
    inside.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Tooltip keyboard", () => {
  it("shows on focus and hides on blur", () => {
    render(
      <Tooltip id="t1" content="Tip">
        <button>Target</button>
      </Tooltip>
    );
    const target = screen.getByText("Target");
    fireEvent.focus(target);
    expect(document.getElementById("t1-tooltip")).toBeTruthy();
    fireEvent.blur(target);
    expect(document.getElementById("t1-tooltip")).toBeNull();
  });
});
