import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "./Sidebar";

describe("Shell Sidebar", () => {
  it("renders the ValueOS shell header branding", () => {
    render(
      <Sidebar
        cases={[]}
        selectedCaseId={null}
        collapsed={false}
        onSelectCase={vi.fn()}
        onToggleCollapse={vi.fn()}
        onNewCase={vi.fn()}
      />
    );

    expect(screen.getByText("ValueOS")).toBeInTheDocument();
    expect(screen.queryByText(/Valynt/i)).not.toBeInTheDocument();
  });
});
