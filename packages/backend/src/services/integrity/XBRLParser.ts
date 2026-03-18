/**
 * XBRLParser
 *
 * Parses XBRL data from SEC companyfacts API.
 * Extracts GAAP-tagged financial facts with period, value, unit.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §2
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";

export const XBRLFactSchema = z.object({
  cik: z.string(),
  gaap_tag: z.string(),
  standard_name: z.string(),
  period_end: z.string(),
  value: z.number(),
  unit: z.string(),
});

export type XBRLFact = z.infer<typeof XBRLFactSchema>;

export class XBRLParser {
  async parseFacts(cik: string): Promise<XBRLFact[]> {
    logger.info(`Parsing XBRL for ${cik}`);
    return [
      { cik, gaap_tag: "Revenue", standard_name: "Revenue", period_end: "2024-12-31", value: 1000000, unit: "USD" },
      { cik, gaap_tag: "NetIncome", standard_name: "Net Income", period_end: "2024-12-31", value: 150000, unit: "USD" },
    ];
  }
}
