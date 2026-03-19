import { describe, expect, it } from "vitest";

import { ComplianceReportService } from "../ComplianceReportService.js";

describe("ComplianceReportService", () => {
  it("generates and stores compliant reports for each requested framework", async () => {
    const service = new ComplianceReportService();

    const reports = await service.checkCompliance(["SOC2", "GDPR"]);

    expect(reports).toHaveLength(2);
    expect(reports.map((report) => report.framework)).toEqual(["SOC2", "GDPR"]);
    expect(service.getComplianceReport(reports[0]!.id)).toEqual(reports[0]);
  });
});
