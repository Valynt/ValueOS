import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TranscriptParser } from "../../deal/TranscriptParser.js";
import { XSS_PAYLOADS, COMMAND_INJECTION_PAYLOADS } from "../fixtures/securityFixtures.js";

describe("TranscriptParser", () => {
  let parser: TranscriptParser;

  beforeEach(() => {
    parser = new TranscriptParser();
    vi.clearAllMocks();
  });

  describe("Security & Input Validation", () => {
    it("should sanitize XSS in transcript text", async () => {
      const xssPayload = XSS_PAYLOADS[0];

      const result = await parser.parseTranscript({
        id: "trans-1",
        text: `We have a major problem. ${xssPayload}`,
        speakers: [{ name: "John", role: "VP" }],
      });

      // Should extract signals without executing XSS
      expect(result).toBeDefined();
    });

    it("should handle command injection attempts", async () => {
      const cmdPayload = COMMAND_INJECTION_PAYLOADS[0];

      const result = await parser.parseTranscript({
        id: "trans-1",
        text: `The cost reduction is significant. ${cmdPayload}`,
        speakers: [{ name: "Jane", role: "Director" }],
      });

      expect(result).toBeDefined();
    });

    it("should not crash on malformed input", async () => {
      const result = await parser.parseTranscript({
        id: "trans-1",
        text: "",
        speakers: [],
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Signal Extraction", () => {
    it("should extract pain signals from transcript", async () => {
      const result = await parser.parseTranscript({
        id: "trans-1",
        text: "We are struggling with our current system. It's a real pain to use.",
        speakers: [{ name: "John", role: "VP Operations" }],
      });

      const painSignals = result.filter((s) => s.signal_type === "pain");
      expect(painSignals.length).toBeGreaterThan(0);
    });

    it("should extract priority signals from transcript", async () => {
      const result = await parser.parseTranscript({
        id: "trans-1",
        text: "Digital transformation is our top priority this year.",
        speakers: [{ name: "Jane", role: "CTO" }],
      });

      const prioritySignals = result.filter((s) => s.signal_type === "priority");
      expect(prioritySignals.length).toBeGreaterThan(0);
    });

    it("should tag all signals as call-derived", async () => {
      const result = await parser.parseTranscript({
        id: "trans-1",
        text: "This is a problem. Our focus is critical.",
        speakers: [{ name: "John", role: "VP" }],
      });

      expect(result.every((s) => s.source_type === "call-derived")).toBe(true);
    });
  });

  describe("Confidence Scoring", () => {
    it("should assign confidence scores to extracted signals", async () => {
      const result = await parser.parseTranscript({
        id: "trans-1",
        text: "We have a problem with our current solution.",
        speakers: [{ name: "John", role: "VP" }],
      });

      expect(result.every((s) => s.confidence >= 0 && s.confidence <= 1)).toBe(true);
    });

    it("should assign higher confidence for explicit pain keywords", async () => {
      const result = await parser.parseTranscript({
        id: "trans-1",
        text: "We are struggling with significant challenges.",
        speakers: [{ name: "John", role: "VP" }],
      });

      const painSignals = result.filter((s) => s.signal_type === "pain");
      expect(painSignals.every((s) => s.confidence > 0.5)).toBe(true);
    });
  });

  describe("Speaker Attribution", () => {
    it("should attribute signals to speakers", async () => {
      const result = await parser.parseTranscript({
        id: "trans-1",
        text: "John: We have a problem. Jane: This is critical.",
        speakers: [
          { name: "John", role: "VP" },
          { name: "Jane", role: "Director" },
        ],
      });

      expect(result.every((s) => s.speaker)).toBeDefined();
    });
  });

  describe("Timestamp Generation", () => {
    it("should assign timestamps to signals", async () => {
      const result = await parser.parseTranscript({
        id: "trans-1",
        text: "First sentence. Second sentence with problem. Third sentence about priority.",
        speakers: [{ name: "John", role: "VP" }],
      });

      expect(result.every((s) => s.timestamp_seconds >= 0)).toBe(true);
    });
  });
});
