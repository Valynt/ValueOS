import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandPaletteProvider, type CommandItem, useCommandPalette } from "./CommandPalette";

const safeNavigateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/safeNavigation", () => ({
  safeNavigate: safeNavigateMock,
}));

function CommandRegistrar({ commands }: { commands: CommandItem[] }) {
  const { registerCommands, openCommandPalette } = useCommandPalette();

  useEffect(() => {
    return registerCommands(commands);
  }, [commands, registerCommands]);

  return (
    <button type="button" onClick={openCommandPalette}>
      Open command palette
    </button>
  );
}

describe("CommandPalette search behavior", () => {
  beforeEach(() => {
    safeNavigateMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("matches mixed-case keywords case-insensitively", async () => {
    const user = userEvent.setup();

    const testCommands: CommandItem[] = [
      {
        id: "kw-1",
        label: "Keyword Command",
        description: "Command searchable by keyword",
        category: "action",
        keywords: ["MiXeDCaSeTag"],
        onSelect: vi.fn(),
      },
    ];

    render(
      <CommandPaletteProvider>
        <CommandRegistrar commands={testCommands} />
      </CommandPaletteProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open command palette" }));

    const input = screen.getByRole("combobox", { name: "Search commands" });
    await user.type(input, "mixedcase");

    expect(screen.getByText("Keyword Command")).toBeInTheDocument();
  });

  it("keeps label and description matching behavior unchanged", async () => {
    const user = userEvent.setup();

    const testCommands: CommandItem[] = [
      {
        id: "label-only",
        label: "Quarterly Forecast",
        category: "action",
        onSelect: vi.fn(),
      },
      {
        id: "description-only",
        label: "Open Insights",
        description: "Contains margin bridge details",
        category: "action",
        onSelect: vi.fn(),
      },
    ];

    render(
      <CommandPaletteProvider>
        <CommandRegistrar commands={testCommands} />
      </CommandPaletteProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open command palette" }));

    const input = screen.getByRole("combobox", { name: "Search commands" });

    await user.type(input, "forecast");
    expect(screen.getByText("Quarterly Forecast")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "margin bridge");
    expect(screen.getByText("Open Insights")).toBeInTheDocument();
  });

  it("returns stable, narrowing results while typing", async () => {
    const user = userEvent.setup();

    const testCommands: CommandItem[] = [
      {
        id: "stable-1",
        label: "Revenue Runway",
        category: "action",
        onSelect: vi.fn(),
      },
      {
        id: "stable-2",
        label: "Revenue Retention",
        category: "action",
        onSelect: vi.fn(),
      },
      {
        id: "stable-3",
        label: "Gross Margin",
        category: "action",
        onSelect: vi.fn(),
      },
    ];

    render(
      <CommandPaletteProvider>
        <CommandRegistrar commands={testCommands} />
      </CommandPaletteProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Open command palette" }));

    const input = screen.getByRole("combobox", { name: "Search commands" });

    await user.type(input, "rev");
    const revMatches = screen.getAllByRole("option").filter((option) =>
      (option.textContent ?? "").includes("Revenue "),
    );
    expect(revMatches).toHaveLength(2);

    await user.type(input, "e");
    const reveMatches = screen.getAllByRole("option").filter((option) =>
      (option.textContent ?? "").includes("Revenue "),
    );
    expect(reveMatches).toHaveLength(2);

    await user.type(input, "n");
    const revenMatches = screen.getAllByRole("option").filter((option) =>
      (option.textContent ?? "").includes("Revenue "),
    );
    expect(revenMatches).toHaveLength(2);
    expect(screen.queryByText("Gross Margin")).not.toBeInTheDocument();
  });
});
