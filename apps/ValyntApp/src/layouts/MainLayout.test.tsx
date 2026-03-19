import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { MainLayout } from "./MainLayout";

vi.mock("./Sidebar", () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}));

vi.mock("./TopBar", () => ({
  TopBar: () => <header>TopBar</header>,
}));

vi.mock("./AgentChatSidebar", () => ({
  AgentChatSidebar: () => null,
}));

describe("MainLayout", () => {
  async function renderLayout() {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/org/acme/dashboard"]}>
        <Routes>
          <Route path="/org/:tenantSlug" element={<MainLayout />}>
            <Route
              path="dashboard"
              element={(
                <div>
                  <h1>Dashboard</h1>
                  <button type="button">Next action</button>
                </div>
              )}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    const main = screen.getByRole("main");

    return { user, skipLink, main };
  }

  it("moves first-tab focus to the skip link and focuses the main region on Enter", async () => {
    const { user, skipLink, main } = await renderLayout();

    await user.tab();

    expect(skipLink).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(main).toHaveFocus();
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabIndex", "-1");
    expect(window.location.hash).toBe("#main-content");
  });

  it("focuses the main region when the skip link is activated with Space", async () => {
    const { user, skipLink, main } = await renderLayout();

    await user.tab();

    expect(skipLink).toHaveFocus();

    await user.keyboard(" ");

    expect(main).toHaveFocus();
    expect(window.location.hash).toBe("#main-content");
  });
});
