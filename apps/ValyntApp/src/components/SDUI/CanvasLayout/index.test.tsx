import { describe, expect, it } from "vitest";

import {
  DashboardPanel as AppDashboardPanel,
  Grid as AppGrid,
  HorizontalSplit as AppHorizontalSplit,
  VerticalSplit as AppVerticalSplit,
} from "./index";
import {
  DashboardPanel as SharedDashboardPanel,
  Grid as SharedGrid,
  HorizontalSplit as SharedHorizontalSplit,
  VerticalSplit as SharedVerticalSplit,
} from "@sdui/components/SDUI/CanvasLayout";

describe("CanvasLayout parity", () => {
  it("re-exports shared package primitives", () => {
    expect(AppDashboardPanel).toBe(SharedDashboardPanel);
    expect(AppGrid).toBe(SharedGrid);
    expect(AppHorizontalSplit).toBe(SharedHorizontalSplit);
    expect(AppVerticalSplit).toBe(SharedVerticalSplit);
  });
});
