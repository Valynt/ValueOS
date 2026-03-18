/**
 * TranscriptParser Tests
 *
 * Task: 9.2 - Unit test TranscriptParser with sample transcript
 */

import { describe, expect, it } from "vitest";

import { TranscriptParser } from "../../../services/deal/TranscriptParser.js";

describe("TranscriptParser", () => {
  const parser = new TranscriptParser();

  describe("parseTranscript", () => {
    it("should extract pain signals from transcript", async () => {
      const transcript = {
        id: "transcript-1",
        text: "We're really struggling with our current process. It's a major pain point for our team.",
        speakers: [{ name: "John", role: "customer" }],
      };

      const signals = await parser.parseTranscript(transcript);

      expect(signals).toBeInstanceOf(Array);
      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].signal_type).toBe("pain");
      expect(signals[0].source_type).toBe("call-derived");
    });

    it("should extract priority signals from transcript", async () => {
      const transcript = {
        id: "transcript-2",
        text: "This is our top priority initiative for Q1. Very important for our strategic goals.",
        speakers: [{ name: "Jane", role: "customer" }],
      };

      const signals = await parser.parseTranscript(transcript);

      expect(signals.length).toBeGreaterThan(0);
      expect(signals.some((s) => s.signal_type === "priority")).toBe(true);
    });

    it("should tag all signals with call-derived source type", async () => {
      const transcript = {
        id: "transcript-3",
        text: "We have a problem with efficiency. This is a critical focus area.",
        speakers: [{ name: "Bob", role: "customer" }],
      };

      const signals = await parser.parseTranscript(transcript);

      signals.forEach((signal) => {
        expect(signal.source_type).toBe("call-derived");
      });
    });
  });
});
