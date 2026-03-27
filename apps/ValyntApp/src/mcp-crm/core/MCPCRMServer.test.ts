import { describe, expect, it, vi } from "vitest";

import { MCPCRMServer } from "./MCPCRMServer";
import type {
  CRMActivity,
  CRMContact,
  CRMDeal,
  CRMModule,
  MCPCRMConfig,
  MCPCRMToolResult,
} from "../types";

const config: MCPCRMConfig = {
  tenantId: "tenant-1",
  userId: "user-1",
  enabledProviders: ["hubspot"],
  refreshTokensAutomatically: true,
};

const baseDeal: CRMDeal = {
  id: "deal-1",
  externalId: "deal-1",
  provider: "hubspot",
  name: "Deal One",
  amount: 10000,
  currency: "USD",
  stage: "proposal",
  probability: 65,
  closeDate: new Date("2026-06-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-01T00:00:00.000Z"),
  ownerName: "Owner",
  companyName: "Company",
  properties: {},
};

const baseContact: CRMContact = {
  id: "contact-1",
  externalId: "contact-1",
  provider: "hubspot",
  firstName: "Casey",
  lastName: "Smith",
  email: "casey@example.com",
  properties: {},
};

const baseActivity: CRMActivity = {
  id: "activity-1",
  externalId: "activity-1",
  provider: "hubspot",
  type: "call",
  subject: "Discovery",
  occurredAt: new Date("2026-02-15T00:00:00.000Z"),
  durationMinutes: 30,
  properties: {},
};

const createModule = (): CRMModule => ({
  provider: "hubspot",
  isConnected: vi.fn(() => true),
  testConnection: vi.fn(async () => true),
  searchDeals: vi.fn(async () => ({ deals: [], total: 0, hasMore: false })),
  getDeal: vi.fn(async () => baseDeal),
  getDealContacts: vi.fn(async () => [baseContact]),
  getDealActivities: vi.fn(async () => [baseActivity]),
  getCompany: vi.fn(async () => null),
  searchCompanies: vi.fn(async () => []),
  updateDealProperties: vi.fn(async () => true),
  addDealNote: vi.fn(async () => true),
});

const callHandleGetDealDetails = async (
  module: CRMModule,
  args: Record<string, unknown>
): Promise<MCPCRMToolResult> => {
  const server = new MCPCRMServer(config);
  const handler = (
    server as unknown as {
      handleGetDealDetails: (
        moduleArg: CRMModule,
        argsArg: Record<string, unknown>,
        responseBuilderArg: unknown,
        startTimeArg: number
      ) => Promise<MCPCRMToolResult>;
    }
  ).handleGetDealDetails.bind(server);

  return handler(module, args, {}, Date.now());
};

describe("MCPCRMServer.handleGetDealDetails", () => {
  it.each([
    {
      includeContacts: undefined,
      includeActivities: undefined,
      expectedContactsCalls: 1,
      expectedActivitiesCalls: 1,
      expectedContactsLength: 1,
      expectedActivitiesLength: 1,
    },
    {
      includeContacts: false,
      includeActivities: true,
      expectedContactsCalls: 0,
      expectedActivitiesCalls: 1,
      expectedContactsLength: 0,
      expectedActivitiesLength: 1,
    },
    {
      includeContacts: true,
      includeActivities: false,
      expectedContactsCalls: 1,
      expectedActivitiesCalls: 0,
      expectedContactsLength: 1,
      expectedActivitiesLength: 0,
    },
    {
      includeContacts: false,
      includeActivities: false,
      expectedContactsCalls: 0,
      expectedActivitiesCalls: 0,
      expectedContactsLength: 0,
      expectedActivitiesLength: 0,
    },
  ])(
    "handles include_contacts=$includeContacts include_activities=$includeActivities",
    async ({
      includeContacts,
      includeActivities,
      expectedContactsCalls,
      expectedActivitiesCalls,
      expectedContactsLength,
      expectedActivitiesLength,
    }) => {
      const module = createModule();
      const result = await callHandleGetDealDetails(module, {
        deal_id: "deal-1",
        include_contacts: includeContacts,
        include_activities: includeActivities,
      });

      expect(module.getDeal).toHaveBeenCalledTimes(1);
      expect(module.getDealContacts).toHaveBeenCalledTimes(expectedContactsCalls);
      expect(module.getDealActivities).toHaveBeenCalledTimes(expectedActivitiesCalls);
      expect(result.success).toBe(true);
      expect((result.data as { contacts: unknown[] }).contacts).toHaveLength(
        expectedContactsLength
      );
      expect((result.data as { recentActivities: unknown[] }).recentActivities).toHaveLength(
        expectedActivitiesLength
      );
      expect(result.metadata?.provider).toBe("hubspot");
      expect(typeof result.metadata?.requestDurationMs).toBe("number");
    }
  );

  it("fetches deal before contacts and activities", async () => {
    const module = createModule();
    await callHandleGetDealDetails(module, { deal_id: "deal-1" });

    expect(module.getDeal).toHaveBeenCalledTimes(1);
    const getDealOrder = vi.mocked(module.getDeal).mock.invocationCallOrder[0];
    const getContactsOrder = vi.mocked(module.getDealContacts).mock.invocationCallOrder[0];
    const getActivitiesOrder = vi.mocked(module.getDealActivities).mock.invocationCallOrder[0];

    expect(getDealOrder).toBeLessThan(getContactsOrder);
    expect(getDealOrder).toBeLessThan(getActivitiesOrder);
  });
});
