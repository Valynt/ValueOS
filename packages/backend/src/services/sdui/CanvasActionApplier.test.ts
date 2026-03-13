/**
 * Tests for CanvasActionApplier
 *
 * Covers applyAtomicActions and findComponentIndices with all action types.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { applyAtomicActions, findComponentIndices } from "./CanvasActionApplier.js";
import type { SDUIPageDefinition } from "@valueos/sdui";
import type { AtomicUIAction } from "@sdui/AtomicUIActions";

function makePage(sections: SDUIPageDefinition["sections"] = []): SDUIPageDefinition {
  return {
    id: "page-1",
    version: 1,
    sections,
    metadata: {},
  } as unknown as SDUIPageDefinition;
}

function makeComponent(id: string, component = "KPICard", extraProps: Record<string, unknown> = {}) {
  return { type: "component" as const, component, version: 1, props: { id, ...extraProps } };
}

// ─── findComponentIndices ────────────────────────────────────────────────────

describe("findComponentIndices", () => {
  it("returns empty array when no sections match", () => {
    const page = makePage([makeComponent("c1")]);
    expect(findComponentIndices(page, { id: "nonexistent" })).toEqual([]);
  });

  it("matches by id", () => {
    const page = makePage([makeComponent("c1"), makeComponent("c2")]);
    expect(findComponentIndices(page, { id: "c2" })).toEqual([1]);
  });

  it("matches by component type", () => {
    const page = makePage([makeComponent("c1", "KPICard"), makeComponent("c2", "Chart")]);
    expect(findComponentIndices(page, { type: "Chart" })).toEqual([1]);
  });

  it("matches by numeric index", () => {
    const page = makePage([makeComponent("c1"), makeComponent("c2")]);
    expect(findComponentIndices(page, { index: 0 })).toEqual([0]);
    expect(findComponentIndices(page, { index: 1 })).toEqual([1]);
  });

  it("returns empty for out-of-range index", () => {
    const page = makePage([makeComponent("c1")]);
    expect(findComponentIndices(page, { index: 5 })).toEqual([]);
  });

  it("matches by props", () => {
    const page = makePage([
      makeComponent("c1", "KPICard", { status: "active" }),
      makeComponent("c2", "KPICard", { status: "inactive" }),
    ]);
    expect(findComponentIndices(page, { props: { status: "active" } })).toEqual([0]);
  });

  it("skips non-component sections", () => {
    const page = makePage([
      { type: "layout.directive", layout: "single-column" } as unknown as SDUIPageDefinition["sections"][0],
      makeComponent("c1"),
    ]);
    expect(findComponentIndices(page, { type: "KPICard" })).toEqual([1]);
  });
});

// ─── applyAtomicActions ──────────────────────────────────────────────────────

describe("applyAtomicActions", () => {
  it("returns a new schema object (does not mutate input)", async () => {
    const original = makePage([makeComponent("c1")]);
    const actions: AtomicUIAction[] = [
      { type: "mutate_component", selector: { id: "c1" }, mutations: [{ path: "props.title", operation: "set", value: "New Title" }] },
    ];
    const result = await applyAtomicActions(original, actions);
    expect(result).not.toBe(original);
    // Original unchanged
    expect((original.sections[0] as { props: Record<string, unknown> }).props.title).toBeUndefined();
  });

  it("applies mutate_component — set operation", async () => {
    const page = makePage([makeComponent("c1")]);
    const result = await applyAtomicActions(page, [
      { type: "mutate_component", selector: { id: "c1" }, mutations: [{ path: "props.title", operation: "set", value: "Hello" }] },
    ]);
    const section = result.sections[0] as { props: Record<string, unknown> };
    expect(section.props.title).toBe("Hello");
  });

  it("applies mutate_component — merge operation", async () => {
    const page = makePage([makeComponent("c1", "KPICard", { config: { color: "red" } })]);
    const result = await applyAtomicActions(page, [
      { type: "mutate_component", selector: { id: "c1" }, mutations: [{ path: "props.config", operation: "merge", value: { size: "large" } }] },
    ]);
    const section = result.sections[0] as { props: Record<string, unknown> };
    expect(section.props.config).toEqual({ color: "red", size: "large" });
  });

  it("applies add_component — append position", async () => {
    const page = makePage([makeComponent("c1")]);
    const result = await applyAtomicActions(page, [
      {
        type: "add_component",
        component: { component: "Chart", version: "1", props: { id: "c2" } },
        position: { append: true },
      },
    ]);
    expect(result.sections).toHaveLength(2);
    expect((result.sections[1] as { component: string }).component).toBe("Chart");
  });

  it("applies add_component — before selector", async () => {
    const page = makePage([makeComponent("c1"), makeComponent("c2")]);
    const result = await applyAtomicActions(page, [
      {
        type: "add_component",
        component: { component: "Divider", version: "1", props: { id: "d1" } },
        position: { before: { id: "c2" } },
      },
    ]);
    expect(result.sections).toHaveLength(3);
    expect((result.sections[1] as { component: string }).component).toBe("Divider");
  });

  it("applies remove_component", async () => {
    const page = makePage([makeComponent("c1"), makeComponent("c2")]);
    const result = await applyAtomicActions(page, [
      { type: "remove_component", selector: { id: "c1" } },
    ]);
    expect(result.sections).toHaveLength(1);
    expect((result.sections[0] as { props: Record<string, unknown> }).props.id).toBe("c2");
  });

  it("applies reorder_components by numeric indices", async () => {
    const page = makePage([makeComponent("c1"), makeComponent("c2"), makeComponent("c3")]);
    const result = await applyAtomicActions(page, [
      { type: "reorder_components", order: [2, 0, 1] },
    ]);
    const ids = result.sections.map((s) => (s as { props: Record<string, unknown> }).props.id);
    expect(ids).toEqual(["c3", "c1", "c2"]);
  });

  it("applies reorder_components by string IDs", async () => {
    const page = makePage([makeComponent("c1"), makeComponent("c2"), makeComponent("c3")]);
    const result = await applyAtomicActions(page, [
      { type: "reorder_components", order: ["c3", "c1", "c2"] },
    ]);
    const ids = result.sections.map((s) => (s as { props: Record<string, unknown> }).props.id);
    expect(ids).toEqual(["c3", "c1", "c2"]);
  });

  it("applies batch action recursively", async () => {
    const page = makePage([makeComponent("c1"), makeComponent("c2")]);
    const result = await applyAtomicActions(page, [
      {
        type: "batch",
        actions: [
          { type: "remove_component", selector: { id: "c1" } },
          { type: "mutate_component", selector: { id: "c2" }, mutations: [{ path: "props.title", operation: "set", value: "Updated" }] },
        ],
      },
    ]);
    expect(result.sections).toHaveLength(1);
    expect((result.sections[0] as { props: Record<string, unknown> }).props.title).toBe("Updated");
  });

  it("continues processing remaining actions when one fails", async () => {
    const page = makePage([makeComponent("c1")]);
    // Selector that matches nothing — should not throw, just warn
    const result = await applyAtomicActions(page, [
      { type: "mutate_component", selector: { id: "nonexistent" }, mutations: [{ path: "props.x", operation: "set", value: 1 }] },
      { type: "mutate_component", selector: { id: "c1" }, mutations: [{ path: "props.title", operation: "set", value: "OK" }] },
    ]);
    expect((result.sections[0] as { props: Record<string, unknown> }).props.title).toBe("OK");
  });

  it("applies mutate_component — append operation on array prop", async () => {
    const page = makePage([makeComponent("c1", "KPICard", { tags: ["a"] })]);
    const result = await applyAtomicActions(page, [
      { type: "mutate_component", selector: { id: "c1" }, mutations: [{ path: "props.tags", operation: "append", value: "b" }] },
    ]);
    expect((result.sections[0] as { props: Record<string, unknown> }).props.tags).toEqual(["a", "b"]);
  });

  it("applies mutate_component — remove operation on object prop", async () => {
    const page = makePage([makeComponent("c1", "KPICard", { obsolete: true })]);
    const result = await applyAtomicActions(page, [
      { type: "mutate_component", selector: { id: "c1" }, mutations: [{ path: "props.obsolete", operation: "remove", value: null }] },
    ]);
    expect((result.sections[0] as { props: Record<string, unknown> }).props.obsolete).toBeUndefined();
  });
});
