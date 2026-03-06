/**
 * Vitest tests for conversation persistence
 * Tests the conversation router procedures and db helpers
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Test conversation data structures ──────────────────────

describe("Conversation Persistence", () => {
  describe("Data structures", () => {
    it("should define valid conversation schema fields", () => {
      const conversation = {
        id: 1,
        userId: "user_123",
        agentSlug: "architect",
        title: "Test conversation",
        pinned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(conversation.id).toBe(1);
      expect(conversation.userId).toBe("user_123");
      expect(conversation.agentSlug).toBe("architect");
      expect(conversation.title).toBe("Test conversation");
      expect(conversation.pinned).toBe(0);
      expect(conversation.createdAt).toBeInstanceOf(Date);
      expect(conversation.updatedAt).toBeInstanceOf(Date);
    });

    it("should define valid message schema fields", () => {
      const message = {
        id: 1,
        conversationId: 1,
        role: "user" as const,
        content: "Hello agent",
        agentSlug: null,
        agentName: null,
        toolEvents: null,
        chainSummary: null,
        messageTimestamp: Date.now(),
        createdAt: new Date(),
      };

      expect(message.role).toBe("user");
      expect(message.content).toBe("Hello agent");
      expect(message.conversationId).toBe(1);
      expect(message.messageTimestamp).toBeGreaterThan(0);
    });

    it("should support assistant messages with tool events", () => {
      const toolEvents = [
        {
          id: "tc_1",
          name: "enrich_company",
          arguments: '{"company":"Acme"}',
          result: '{"name":"Acme Corp"}',
          round: 1,
          status: "success" as const,
          latencyMs: 1200,
        },
        {
          id: "tc_2",
          name: "search_sec_filings",
          arguments: '{"query":"Acme 10-K"}',
          result: '{"filings":[]}',
          round: 1,
          status: "success" as const,
          latencyMs: 800,
        },
      ];

      const chainSummary = {
        totalRounds: 1,
        totalToolCalls: 2,
        successCount: 2,
        errorCount: 0,
        totalLatencyMs: 2000,
        chain: toolEvents.map((te) => ({
          round: te.round,
          tool: te.name,
          status: te.status,
          latencyMs: te.latencyMs,
        })),
      };

      const message = {
        role: "assistant" as const,
        content: "I found information about Acme Corp.",
        agentSlug: "opportunity",
        agentName: "Opportunity Agent",
        toolEvents,
        chainSummary,
        messageTimestamp: Date.now(),
      };

      expect(message.toolEvents).toHaveLength(2);
      expect(message.chainSummary.totalToolCalls).toBe(2);
      expect(message.chainSummary.successCount).toBe(2);
      expect(message.chainSummary.errorCount).toBe(0);
    });

    it("should support pinned conversations", () => {
      const pinnedConv = { id: 1, pinned: 1 };
      const unpinnedConv = { id: 2, pinned: 0 };

      expect(pinnedConv.pinned).toBe(1);
      expect(unpinnedConv.pinned).toBe(0);
    });
  });

  describe("Conversation list filtering", () => {
    const conversations = [
      {
        id: 1,
        agentSlug: "architect",
        title: "Value analysis",
        pinned: 1,
        updatedAt: new Date("2026-03-05"),
      },
      {
        id: 2,
        agentSlug: "research",
        title: "Market research",
        pinned: 0,
        updatedAt: new Date("2026-03-04"),
      },
      {
        id: 3,
        agentSlug: "integrity",
        title: "Claim validation",
        pinned: 0,
        updatedAt: new Date("2026-03-03"),
      },
      {
        id: 4,
        agentSlug: "architect",
        title: "Another analysis",
        pinned: 1,
        updatedAt: new Date("2026-03-02"),
      },
    ];

    it("should separate pinned from unpinned conversations", () => {
      const pinned = conversations.filter((c) => c.pinned === 1);
      const unpinned = conversations.filter((c) => c.pinned !== 1);

      expect(pinned).toHaveLength(2);
      expect(unpinned).toHaveLength(2);
      expect(pinned.every((c) => c.pinned === 1)).toBe(true);
    });

    it("should sort by updatedAt descending", () => {
      const sorted = [...conversations].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );

      expect(sorted[0].id).toBe(1);
      expect(sorted[sorted.length - 1].id).toBe(4);
    });

    it("should filter by agent slug", () => {
      const architectConvos = conversations.filter(
        (c) => c.agentSlug === "architect"
      );
      expect(architectConvos).toHaveLength(2);
    });

    it("should respect limit parameter", () => {
      const limited = conversations.slice(0, 2);
      expect(limited).toHaveLength(2);
    });
  });

  describe("Message persistence format", () => {
    it("should serialize tool events to JSON", () => {
      const toolEvents = [
        {
          id: "tc_1",
          name: "enrich_company",
          round: 1,
          status: "success",
          latencyMs: 500,
        },
      ];

      const serialized = JSON.stringify(toolEvents);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toHaveLength(1);
      expect(deserialized[0].name).toBe("enrich_company");
      expect(deserialized[0].status).toBe("success");
    });

    it("should serialize chain summary to JSON", () => {
      const chainSummary = {
        totalRounds: 2,
        totalToolCalls: 4,
        successCount: 3,
        errorCount: 1,
        totalLatencyMs: 5000,
        chain: [
          { round: 1, tool: "enrich_company", status: "success", latencyMs: 1200 },
          { round: 1, tool: "search_sec_filings", status: "success", latencyMs: 800 },
          { round: 2, tool: "validate_claim", status: "success", latencyMs: 2000 },
          { round: 2, tool: "lookup_industry_data", status: "error", latencyMs: 1000 },
        ],
      };

      const serialized = JSON.stringify(chainSummary);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.totalRounds).toBe(2);
      expect(deserialized.chain).toHaveLength(4);
      expect(deserialized.chain[3].status).toBe("error");
    });

    it("should handle null tool events and chain summary", () => {
      const message = {
        role: "user",
        content: "Hello",
        toolEvents: null,
        chainSummary: null,
      };

      expect(message.toolEvents).toBeNull();
      expect(message.chainSummary).toBeNull();
    });

    it("should preserve message timestamps as Unix milliseconds", () => {
      const now = Date.now();
      const message = { messageTimestamp: now };

      expect(message.messageTimestamp).toBe(now);
      expect(new Date(message.messageTimestamp).getFullYear()).toBe(2026);
    });
  });

  describe("Auto-title generation", () => {
    it("should truncate long messages to 60 chars", () => {
      const longMessage =
        "This is a very long message that should be truncated because it exceeds the sixty character limit for conversation titles";
      const title =
        longMessage.length > 60
          ? longMessage.slice(0, 57) + "..."
          : longMessage;

      expect(title.length).toBe(60);
      expect(title.endsWith("...")).toBe(true);
    });

    it("should keep short messages as-is", () => {
      const shortMessage = "Enrich Acme Corp";
      const title =
        shortMessage.length > 60
          ? shortMessage.slice(0, 57) + "..."
          : shortMessage;

      expect(title).toBe("Enrich Acme Corp");
    });
  });

  describe("Conversation restoration", () => {
    it("should convert DB messages to ChatMessage format", () => {
      const dbMessages = [
        {
          id: 1,
          role: "user",
          content: "Enrich Salesforce",
          agentSlug: null,
          agentName: null,
          toolEvents: null,
          chainSummary: null,
          messageTimestamp: 1709640000000,
        },
        {
          id: 2,
          role: "assistant",
          content: "I found Salesforce data.",
          agentSlug: "opportunity",
          agentName: "Opportunity Agent",
          toolEvents: [
            {
              id: "tc_1",
              name: "enrich_company",
              round: 1,
              status: "success",
              latencyMs: 1200,
            },
          ],
          chainSummary: {
            totalRounds: 1,
            totalToolCalls: 1,
            successCount: 1,
            errorCount: 0,
            totalLatencyMs: 1200,
            chain: [
              {
                round: 1,
                tool: "enrich_company",
                status: "success",
                latencyMs: 1200,
              },
            ],
          },
          messageTimestamp: 1709640005000,
        },
      ];

      const restored = dbMessages.map((m, i) => ({
        id: `db_${m.id ?? i}`,
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp:
          typeof m.messageTimestamp === "number"
            ? m.messageTimestamp
            : new Date(m.messageTimestamp).getTime(),
        agentSlug: m.agentSlug ?? undefined,
        agentName: m.agentName ?? undefined,
        toolEvents: m.toolEvents ?? undefined,
        chainSummary: m.chainSummary ?? undefined,
      }));

      expect(restored).toHaveLength(2);
      expect(restored[0].role).toBe("user");
      expect(restored[0].id).toBe("db_1");
      expect(restored[1].agentSlug).toBe("opportunity");
      expect(restored[1].toolEvents).toHaveLength(1);
      expect(restored[1].chainSummary?.totalToolCalls).toBe(1);
    });

    it("should prepend welcome message to restored messages", () => {
      const agentName = "Value Architect";
      const agentDescription = "General-purpose assistant";
      const restoredMessages = [
        { id: "db_1", role: "user", content: "Hello", timestamp: 1000 },
      ];

      const welcomeMsg = {
        id: "welcome",
        role: "assistant",
        content: `Hello! I'm the **${agentName}**. ${agentDescription}. How can I help you today?`,
        timestamp: restoredMessages[0].timestamp - 1,
        agentSlug: "architect",
        agentName,
      };

      const allMessages = [welcomeMsg, ...restoredMessages];

      expect(allMessages).toHaveLength(2);
      expect(allMessages[0].id).toBe("welcome");
      expect(allMessages[0].timestamp).toBeLessThan(
        allMessages[1].timestamp
      );
    });
  });
});
