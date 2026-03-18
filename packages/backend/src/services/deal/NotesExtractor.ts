/**
 * NotesExtractor
 *
 * Extracts signals from seller notes and summaries.
 * Tags each extracted signal with source type 'note-derived'.
 *
 * Reference: openspec/changes/deal-assembly-pipeline/tasks.md §3.4, 3.5
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";

export const NoteSignalSchema = z.object({
  id: z.string().uuid(),
  signal_type: z.enum(["pain", "priority", "stakeholder_mention", "baseline_clue", "use_case", "objection", "timeline", "budget"]),
  text: z.string(),
  confidence: z.number().min(0).max(1),
  source_type: z.literal("note-derived"),
  extracted_at: z.string().datetime(),
  note_reference: z.string().optional(), // Reference to note ID or title
});

export type NoteSignal = z.infer<typeof NoteSignalSchema>;

export interface NoteInput {
  id: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
}

export class NotesExtractor {
  async extractFromNotes(notes: NoteInput[]): Promise<NoteSignal[]> {
    logger.info(`Extracting signals from ${notes.length} notes`);

    const allSignals: NoteSignal[] = [];

    for (const note of notes) {
      const signals = this.extractFromNote(note);
      allSignals.push(...signals);
    }

    logger.info(`Extracted ${allSignals.length} signals from notes`);
    return allSignals;
  }

  private extractFromNote(note: NoteInput): NoteSignal[] {
    const signals: NoteSignal[] = [];
    const lines = note.content.split(/\n|\./);

    for (const line of lines) {
      const signal = this.extractSignal(line, note);
      if (signal) signals.push(signal);
    }

    return signals;
  }

  private extractSignal(text: string, note: NoteInput): NoteSignal | null {
    // Pain keywords
    const painKeywords = ["problem", "issue", "pain", "challenge", "struggling", "difficult", "frustrated", "bottleneck"];
    // Priority keywords
    const priorityKeywords = ["important", "priority", "focus", "key initiative", "strategic", "critical", "must have"];
    // Use case keywords
    const useCaseKeywords = ["use case", "scenario", "application", "implementation", "deployment"];
    // Budget keywords
    const budgetKeywords = ["budget", "funding", "cost", "price", "spend", "investment", "approved"];
    // Timeline keywords
    const timelineKeywords = ["timeline", "deadline", "go-live", "launch", "q1", "q2", "q3", "q4", "2024", "2025"];

    let signalType: NoteSignal["signal_type"] | null = null;

    if (painKeywords.some((k) => text.toLowerCase().includes(k))) signalType = "pain";
    else if (priorityKeywords.some((k) => text.toLowerCase().includes(k))) signalType = "priority";
    else if (useCaseKeywords.some((k) => text.toLowerCase().includes(k))) signalType = "use_case";
    else if (budgetKeywords.some((k) => text.toLowerCase().includes(k))) signalType = "budget";
    else if (timelineKeywords.some((k) => text.toLowerCase().includes(k))) signalType = "timeline";

    if (!signalType) return null;

    return {
      id: crypto.randomUUID(),
      signal_type: signalType,
      text: text.slice(0, 500).trim(),
      confidence: 0.6, // Lower confidence for notes vs transcripts
      source_type: "note-derived",
      extracted_at: new Date().toISOString(),
      note_reference: note.id,
    };
  }
}
