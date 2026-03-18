/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { SensitivityTornado } from "../SensitivityTornado";

describe("SensitivityTornado", () => {
  const mockTornadoData = [
    { assumptionId: "a1", assumptionName: "Employee Count", impactPositive: 50000, impactNegative: -30000, leverage: 2.5 },
    { assumptionId: "a2", assumptionName: "Growth Rate", impactPositive: 80000, impactNegative: -60000, leverage: 3.2 },
    { assumptionId: "a3", assumptionName: "Cost per Unit", impactPositive: 40000, impactNegative: -45000, leverage: 1.8 },
  ];

  it("renders tornado chart bars", () => {
    render(<SensitivityTornado id="sensitivity-tornado" data={{ tornadoData: mockTornadoData, baseScenario: "base" }} />);

    expect(screen.getByText("Employee Count")).toBeInTheDocument();
    expect(screen.getByText("Growth Rate")).toBeInTheDocument();
    expect(screen.getByText("Cost per Unit")).toBeInTheDocument();
  });

  it("emits navigate action when bar is clicked", () => {
    const onAction = vi.fn();
    render(
      <SensitivityTornado
        id="sensitivity-tornado"
        data={{ tornadoData: mockTornadoData, baseScenario: "base" }}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByText("Growth Rate"));
    expect(onAction).toHaveBeenCalledWith("navigate", { assumptionId: "a2" });
  });

  it("displays positive and negative impact values", () => {
    render(<SensitivityTornado id="sensitivity-tornado" data={{ tornadoData: mockTornadoData, baseScenario: "base" }} />);

    expect(screen.getByText("+$80,000")).toBeInTheDocument();
    expect(screen.getByText("-$60,000")).toBeInTheDocument();
  });

  it("shows leverage score for each assumption", () => {
    render(<SensitivityTornado id="sensitivity-tornado" data={{ tornadoData: mockTornadoData, baseScenario: "base" }} />);

    expect(screen.getByText("3.2x")).toBeInTheDocument();
  });

  it("sorts assumptions by leverage by default", () => {
    render(<SensitivityTornado id="sensitivity-tornado" data={{ tornadoData: mockTornadoData, baseScenario: "base" }} />);

    const items = screen.getAllByText(/Employee|Growth|Cost/);
    // Growth Rate should appear first due to highest leverage
    expect(items[0].textContent).toBe("Growth Rate");
  });
});
