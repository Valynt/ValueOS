import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComplianceModePage } from "./ComplianceModePage";
import { ComplianceModeStatus } from "./types";

const mockGet = vi.fn();

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

vi.mock("./useComplianceLiveStatus", () => ({
  useComplianceLiveStatus: () => ({
    data: {
      controls: [
        {
          control_id: "ctrl-1",
          framework: "SOC2",
          status: "pass",
          evidence_ts: "2026-03-21T00:00:00.000Z",
          tenant_id: "tenant-1",
          evidence_pointer: "evidence://soc2/ctrl-1",
          metric_value: 99,
          metric_unit: "percent",
          evidence_recency_minutes: 15,
        },
      ],
      generated_at: "2026-03-21T00:00:00.000Z",
      summary: {
        controls_total: 1,
        controls_passing: 1,
        controls_warning: 0,
        controls_failing: 0,
      },
      tenant_id: "tenant-1",
    },
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("ComplianceModePage", () => {
  afterEach(() => {
    mockGet.mockReset();
  });

  it("renders selectable frameworks exactly from /api/admin/compliance/mode and shows HIPAA gating reasons", async () => {
    const modeResponse: ComplianceModeStatus = {
      tenant_id: "tenant-1",
      active_modes: ["GDPR", "SOC2", "ISO27001"],
      strict_enforcement: true,
      last_changed_at: "2026-03-21T00:00:00.000Z",
      framework_statuses: [
        {
          framework: "GDPR",
          availability: "available",
          selectable: true,
          prerequisites_met: true,
          gate_label: "prerequisite_gating",
          missing_prerequisites: [],
        },
        {
          framework: "SOC2",
          availability: "available",
          selectable: true,
          prerequisites_met: true,
          gate_label: "prerequisite_gating",
          missing_prerequisites: [],
        },
        {
          framework: "ISO27001",
          availability: "available",
          selectable: true,
          prerequisites_met: true,
          gate_label: "prerequisite_gating",
          missing_prerequisites: [],
        },
        {
          framework: "HIPAA",
          availability: "gated",
          selectable: false,
          prerequisites_met: false,
          gate_label: "prerequisite_gating",
          missing_prerequisites: [
            "Data classification for PHI-bearing assets",
            "Break-glass access logging",
          ],
        },
      ],
    };

    mockGet.mockResolvedValue({ data: modeResponse });

    render(<ComplianceModePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/api/admin/compliance/mode");
      expect(screen.getAllByText("GDPR").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("SOC2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ISO27001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("HIPAA")).toHaveLength(1);
    expect(screen.getByText("Gated / unavailable until prerequisites are met.")).toBeInTheDocument();
    expect(screen.getByText("Data classification for PHI-bearing assets")).toBeInTheDocument();
    expect(screen.getByText("Break-glass access logging")).toBeInTheDocument();
  });
});
