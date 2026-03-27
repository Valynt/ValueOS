/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../common/Toast";
import { InlineEditor } from "../InlineEditor";

function renderWithProviders(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("InlineEditor", () => {
  const mockContent = "The projected ROI is 150% based on current assumptions.";

  it("enters edit mode when activated", () => {
    renderWithProviders(<InlineEditor id="inline-editor" data={{ content: mockContent, sectionId: "sec-1" }} />);

    fireEvent.click(screen.getByText(mockContent));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows save and cancel buttons in edit mode", () => {
    renderWithProviders(<InlineEditor id="inline-editor" data={{ content: mockContent, sectionId: "sec-1" }} />);

    fireEvent.click(screen.getByText(mockContent));
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("emits save action with content and reason", () => {
    const onAction = vi.fn();
    renderWithProviders(
      <InlineEditor
        id="inline-editor"
        data={{ content: mockContent, sectionId: "sec-1" }}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByText(mockContent));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Updated content with 200% ROI" } });

    const reasonInput = screen.getByPlaceholderText("Reason for edit...");
    fireEvent.change(reasonInput, { target: { value: "Updated based on new data" } });

    fireEvent.click(screen.getByText("Save"));

    expect(onAction).toHaveBeenCalledWith("save", {
      sectionId: "sec-1",
      content: "Updated content with 200% ROI",
      reason: "Updated based on new data",
    });
  });

  it("reverts to original content on cancel", () => {
    const onAction = vi.fn();
    renderWithProviders(
      <InlineEditor
        id="inline-editor"
        data={{ content: mockContent, sectionId: "sec-1" }}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByText(mockContent));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Modified content" } });

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByText(mockContent)).toBeInTheDocument();
  });

  it("highlights modified sections with diff styling", () => {
    renderWithProviders(<InlineEditor id="inline-editor" data={{ content: mockContent, sectionId: "sec-1", isModified: true }} />);

    const content = screen.getByText(mockContent).closest("div");
    expect(content?.className).toContain("bg-yellow");
  });

  it("announces state changes via aria-live", () => {
    renderWithProviders(<InlineEditor id="inline-editor" data={{ content: mockContent, sectionId: "sec-1" }} />);

    fireEvent.click(screen.getByText(mockContent));
    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent(/editing/i);
  });
});
