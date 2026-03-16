// Stub for react-dnd — not installed in the test environment.
// Tests that import components using useDrag/useDrop get no-op implementations.
import { vi } from "vitest";

export const useDrag = () => [{ isDragging: false }, vi.fn(), vi.fn()];
export const useDrop = () => [{ isOver: false, canDrop: false }, vi.fn()];
export const DndProvider = ({ children }: { children: unknown }) => children;
export const HTML5Backend = {};
