import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../lib/logger.js";
import { CustomerAccessService } from "../CustomerAccessService.js";
import { emailService } from "../EmailService.js";

vi.mock("../EmailService", () => ({
  emailService: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe("CustomerAccessService portal URL redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never logs a raw portal token or full portal URL", async () => {
    const service = new CustomerAccessService();
    const portalUrl = "https://app.valuecanvas.com/customer/portal?token=super-secret-token";

    await service.sendPortalAccessEmail("buyer@example.com", "Acme Corp", portalUrl);

    const logEntries = vi.mocked(logger.info).mock.calls.map((call) => call[1]);
    expect(logEntries).toContainEqual(
      expect.objectContaining({
        portalUrlRedacted: "https://app.valuecanvas.com/customer/portal?token=%5BREDACTED%5D",
      })
    );
    expect(JSON.stringify(logEntries)).not.toContain("super-secret-token");
    expect(JSON.stringify(logEntries)).not.toContain(portalUrl);
    expect(emailService.send).toHaveBeenCalledOnce();
  });
});
