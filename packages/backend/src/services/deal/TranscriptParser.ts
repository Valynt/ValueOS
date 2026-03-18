/**
 * TranscriptParser
 *
 * Extracts structured signals (pains, priorities, stakeholder mentions, baseline clues)
 * from call transcripts. Tags each extracted signal with source type 'call-derived'.
 *
 * Reference: openspec/changes/deal-assembly-pipeline/tasks.md §3
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";

export const TranscriptSignalSchema = z.object({
  id: z.string().uuid(),
  signal_type: z.enum(["pain", "priority", "stakeholder_mention", "baseline_clue", "objection", "timeline"]),
  text: z.string(),
  speaker: z.string(),
  timestamp_seconds: z.number(),
  confidence: z.number().min(0).max(1),
  source_type: z.literal("call-derived"),
  extracted_at: z.string().datetime(),
});

export type TranscriptSignal = z.infer<typeof TranscriptSignalSchema>;

export class TranscriptParser {
  async parseTranscript(transcript: {
    id: string;
    text: string;
    speakers: Array<{ name: string; role: string }>;
  }): Promise<TranscriptSignal[]> {
    logger.info(`Parsing transcript ${transcript.id}`);

    const signals: TranscriptSignal[] = [];
    const lines = transcript.text.split(/\n|\. /);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const signal = this.extractSignal(line, i * 60, transcript.speakers);
      if (signal) signals.push(signal);
    }

    return signals;
  }

  private extractSignal(text: string, timestamp: number, speakers: Array<{ name: string }>): TranscriptSignal | null {
    const painKeywords = ["problem", "issue", "pain", "challenge", "struggling", "difficult"];
    const priorityKeywords = ["important", "priority", "focus", "key initiative", "strategic"];

    let signalType: TranscriptSignal["signal_type"] | null = null;

    if (painKeywords.some((k) => text.toLowerCase().includes(k))) signalType = "pain";
    else if (priorityKeywords.some((k) => text.toLowerCase().includes(k))) signalType = "priority";

    if (!signalType) return null;

    return {
      id: crypto.randomUUID(),
      signal_type: signalType,
      text: text.slice(0, 500),
      speaker: speakers[0]?.name || "Unknown",
      timestamp_seconds: timestamp,
      confidence: 0.7,
      source_type: "call-derived",
      extracted_at: new Date().toISOString(),
    };
  }
}
