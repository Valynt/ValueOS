/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { InlineEditor } from "../../components/canvas/widgets/InlineEditor";

describe("Integration: Inline Edit with Audit Trail", () => {
  const mockContent = "The projected ROI is 150% based on current assumptions.";

  it("logs edit with reason on save", () => {
    const onSave = vi.fn();

    render(
      <InlineEditor
        id="inline-editor"
        data={{ content: mockContent, sectionId: "sec-1" }}
        onAction={onSave}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText(mockContent));

    // Modify content
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Updated ROI to 200%" } });

    // Add reason
    const reasonInput = screen.getByPlaceholderText("Reason for edit...");
    fireEvent.change(reasonInput, { target: { value: "New market data available" } });

    // Save
    fireEvent.click(screen.getByText("Save"));

    // Verify audit log entry would be created
    expect(onSave).toHaveBeenCalledWith("save", {
      sectionId: "sec-1",
      content: "Updated ROI to 200%",
      reason: "New market data available",
    });
  });

  it("shows diff highlight for modified sections", () => {
    render(
      <InlineEditor
        id="inline-editor"
        data={{ content: mockContent, sectionId: "sec-1", isModified: true }}
      />
    );

    const content = screen.getByText(mockContent).closest("div");
    expect(content?.className).toContain("modified");
  });

  it("reverts without logging on cancel", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
      <InlineEditor
        id="inline-editor"
        data={{ content: mockContent, sectionId: "sec-1" }}
        onAction={(action, payload) => {
          if (action === "cancel") onCancel();
          if (action === "save") onSave(payload);
        }}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText(mockContent));

    // Modify content
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Modified content" } });

    // Cancel
    fireEvent.click(screen.getByText("Cancel"));

    // Verify no save was called
    expect(onSave).not.toHaveBeenCalled();
  });
});
