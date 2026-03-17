/**
 * PptxExportService
 *
 * Generates a PowerPoint (.pptx) export of a value case and uploads it to
 * Supabase Storage. Returns a signed URL valid for 1 hour.
 *
 * Slide structure (4 slides):
 *   1. Title — case title, owner, date
 *   2. Executive Summary — narrative draft content
 *   3. Financial Model — ROI, NPV, payback period
 *   4. Hypotheses — latest OpportunityAgent hypotheses, one row per hypothesis with a single expected impact value
 *
 * pptxgenjs is loaded via dynamic import so the service starts without it
 * in environments where it is unavailable (same pattern as PdfExportService).
 *
 * Bucket: "exports" (must exist in Supabase Storage with private access).
 * Path:   {organization_id}/value-cases/{case_id}/{timestamp}.pptx
 */

import { createLogger } from '@shared/lib/logger';
import { createServerSupabaseClient } from '../../lib/supabase.js';
import { NarrativeDraftRepository } from '../../repositories/NarrativeDraftRepository.js';
import { financialModelSnapshotRepository } from '../../repositories/FinancialModelSnapshotRepository.js';
import { HypothesisOutputService } from '../value/HypothesisOutputService.js';

const logger = createLogger({ service: 'PptxExportService' });

const EXPORTS_BUCKET = 'exports';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PptxExportInput {
  organizationId: string;
  caseId: string;
  /** Human-readable title for the deck cover slide. */
  title: string;
  /** Display name of the case owner (shown on cover). */
  ownerName?: string;
}

export interface PptxExportResult {
  /** Signed Supabase Storage URL, valid for 1 hour. */
  signedUrl: string;
  /** Storage path within the exports bucket. */
  storagePath: string;
  /** Size of the generated .pptx in bytes. */
  sizeBytes: number;
  /** ISO timestamp of when the export was created. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Slide theme constants
// ---------------------------------------------------------------------------

const BRAND_DARK = '1A1A2E';
const BRAND_ACCENT = '4F46E5';
const WHITE = 'FFFFFF';
const LIGHT_GRAY = 'F3F4F6';
const DARK_TEXT = '111827';
const MUTED_TEXT = '6B7280';

const TITLE_FONT = 'Calibri';
const BODY_FONT = 'Calibri';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Minimal shape of a hypothesis as stored by OpportunityAgent. */
interface HypothesisItem {
  title?: string;
  description?: string;
  category?: string;
  estimated_impact?: {
    low?: number;
    high?: number;
    unit?: string;
    timeframe_months?: number;
    value?: number;
  };
  confidence?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PptxExportService {
  private supabase: ReturnType<typeof createServerSupabaseClient>;
  private narrativeRepo: NarrativeDraftRepository;
  private hypothesisOutputService: HypothesisOutputService;

  constructor() {
    this.supabase = createServerSupabaseClient();
    this.narrativeRepo = new NarrativeDraftRepository();
    this.hypothesisOutputService = new HypothesisOutputService();
  }

  async exportValueCase(input: PptxExportInput): Promise<PptxExportResult> {
    const { organizationId, caseId, title, ownerName } = input;
    const createdAt = new Date().toISOString();
    const timestamp = createdAt.replace(/[:.]/g, '-');
    const storagePath = `${organizationId}/value-cases/${caseId}/${timestamp}.pptx`;

    logger.info('PptxExportService: generating deck', { caseId });

    const [narrative, financialSnapshot, hypothesisOutput] = await Promise.all([
      this.narrativeRepo.getLatestForCase(caseId, organizationId).catch(() => null),
      financialModelSnapshotRepository.getLatestSnapshotForCase(caseId, organizationId).catch(() => null),
      this.hypothesisOutputService.getLatestForCase(caseId, organizationId).catch(() => null),
    ]);

    const pptxBuffer = await this.buildDeck({
      title,
      ownerName,
      createdAt,
      narrativeContent: narrative?.content ?? null,
      roi: financialSnapshot?.roi ?? null,
      npv: financialSnapshot?.npv ?? null,
      paybackMonths: financialSnapshot?.payback_period_months ?? null,
      hypotheses: (hypothesisOutput?.hypotheses ?? []) as HypothesisItem[],
    });

    logger.info('PptxExportService: uploading to storage', {
      caseId,
      storagePath,
      sizeBytes: pptxBuffer.length,
    });

    const { error: uploadError } = await this.supabase.storage
      .from(EXPORTS_BUCKET)
      .upload(storagePath, pptxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: signedData, error: signError } = await this.supabase.storage
      .from(EXPORTS_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signError || !signedData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signError?.message ?? 'unknown'}`);
    }

    return {
      signedUrl: signedData.signedUrl,
      storagePath,
      sizeBytes: pptxBuffer.length,
      createdAt,
    };
  }

  // ---- Private helpers ----

  private async buildDeck(data: {
    title: string;
    ownerName?: string;
    createdAt: string;
    narrativeContent: string | null;
    roi: number | null;
    npv: number | null;
    paybackMonths: number | null;
    hypotheses: HypothesisItem[];
  }): Promise<Buffer> {
    // Dynamic import keeps pptxgenjs optional at startup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let PptxGenJS: any;
    try {
      const mod = await import('pptxgenjs');
      PptxGenJS = mod.default;
    } catch {
      throw new Error(
        'pptxgenjs is not installed. Run: pnpm add pptxgenjs --filter @valueos/backend',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pptx: InstanceType<typeof PptxGenJS> = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 13.33" × 7.5"
    pptx.author = 'ValueOS';
    pptx.company = 'ValueOS';
    pptx.subject = data.title;
    pptx.title = data.title;

    this.addCoverSlide(pptx, data.title, data.ownerName, data.createdAt);
    this.addExecutiveSummarySlide(pptx, data.narrativeContent);
    this.addFinancialSlide(pptx, data.roi, data.npv, data.paybackMonths);
    this.addHypothesesSlide(pptx, data.hypotheses);

    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    return buffer as Buffer;
  }

  // Slide 1: Cover
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addCoverSlide(pptx: InstanceType<any>, title: string, ownerName: string | undefined, createdAt: string): void {
    const slide = pptx.addSlide();

    // Dark background
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: BRAND_DARK },
    });

    // Accent bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 5.8, w: '100%', h: 0.08,
      fill: { color: BRAND_ACCENT },
    });

    // Title
    slide.addText(title, {
      x: 0.8, y: 1.8, w: 11.7, h: 1.6,
      fontSize: 36,
      bold: true,
      color: WHITE,
      fontFace: TITLE_FONT,
      align: 'left',
      wrap: true,
    });

    // Subtitle line
    const dateStr = new Date(createdAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const subtitle = ownerName ? `${ownerName}  ·  ${dateStr}` : dateStr;
    slide.addText(subtitle, {
      x: 0.8, y: 3.6, w: 11.7, h: 0.5,
      fontSize: 14,
      color: 'A5B4FC',
      fontFace: BODY_FONT,
      align: 'left',
    });

    // Watermark label
    slide.addText('ValueOS', {
      x: 0.8, y: 6.6, w: 3, h: 0.4,
      fontSize: 11,
      color: MUTED_TEXT,
      fontFace: BODY_FONT,
    });
  }

  // Slide 2: Executive Summary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addExecutiveSummarySlide(pptx: InstanceType<any>, content: string | null): void {
    const slide = pptx.addSlide();

    // Light background
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: WHITE },
    });

    // Accent header bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.9,
      fill: { color: BRAND_ACCENT },
    });

    slide.addText('Executive Summary', {
      x: 0.5, y: 0.1, w: 12.3, h: 0.7,
      fontSize: 20,
      bold: true,
      color: WHITE,
      fontFace: TITLE_FONT,
    });

    const body = content
      ? content.substring(0, 1200) + (content.length > 1200 ? '…' : '')
      : 'No executive summary has been generated for this value case yet.';

    slide.addText(body, {
      x: 0.5, y: 1.1, w: 12.3, h: 5.8,
      fontSize: 13,
      color: DARK_TEXT,
      fontFace: BODY_FONT,
      align: 'left',
      valign: 'top',
      wrap: true,
    });
  }

  // Slide 3: Financial Model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addFinancialSlide(pptx: InstanceType<any>, roi: number | null, npv: number | null, paybackMonths: number | null): void {
    const slide = pptx.addSlide();

    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: LIGHT_GRAY },
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.9,
      fill: { color: BRAND_ACCENT },
    });

    slide.addText('Financial Model', {
      x: 0.5, y: 0.1, w: 12.3, h: 0.7,
      fontSize: 20,
      bold: true,
      color: WHITE,
      fontFace: TITLE_FONT,
    });

    const metrics: Array<{ label: string; value: string }> = [
      {
        label: 'ROI',
        value: roi != null ? `${(roi * 100).toFixed(1)}%` : 'Pending',
      },
      {
        label: 'NPV',
        value: npv != null
          ? `$${(npv / 1_000_000).toFixed(2)}M`
          : 'Pending',
      },
      {
        label: 'Payback Period',
        value: paybackMonths != null ? `${paybackMonths} months` : 'Pending',
      },
    ];

    const cardW = 3.8;
    const cardH = 2.4;
    const startX = 0.7;
    const cardY = 1.8;
    const gap = 0.55;

    metrics.forEach((metric, i) => {
      const x = startX + i * (cardW + gap);

      // Card background
      slide.addShape(pptx.ShapeType.rect, {
        x, y: cardY, w: cardW, h: cardH,
        fill: { color: WHITE },
        line: { color: 'E5E7EB', width: 1 },
        shadow: { type: 'outer', blur: 4, offset: 2, angle: 45, color: '00000020' },
      });

      // Metric value
      slide.addText(metric.value, {
        x: x + 0.2, y: cardY + 0.35, w: cardW - 0.4, h: 1.1,
        fontSize: 32,
        bold: true,
        color: BRAND_ACCENT,
        fontFace: TITLE_FONT,
        align: 'center',
      });

      // Label
      slide.addText(metric.label, {
        x: x + 0.2, y: cardY + 1.55, w: cardW - 0.4, h: 0.5,
        fontSize: 13,
        color: MUTED_TEXT,
        fontFace: BODY_FONT,
        align: 'center',
      });
    });

    // Footer note
    slide.addText('Financial projections are based on the latest OpportunityAgent hypotheses and agent-modelled assumptions.', {
      x: 0.5, y: 6.6, w: 12.3, h: 0.4,
      fontSize: 9,
      color: MUTED_TEXT,
      fontFace: BODY_FONT,
      italic: true,
    });
  }

  // Slide 4: Hypotheses
  // Renders the latest OpportunityAgent hypotheses for this case. All hypotheses provided
  // in the `hypotheses` array are shown as-is; there is currently no concept of a separate
  // “validated” subset or low–high value ranges. Impact is rendered as a single expected value.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private addHypothesesSlide(pptx: InstanceType<any>, hypotheses: HypothesisItem[]): void {
    const slide = pptx.addSlide();

    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: WHITE },
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.9,
      fill: { color: BRAND_ACCENT },
    });

    slide.addText('Value Hypotheses (latest OpportunityAgent output)', {
      x: 0.5, y: 0.1, w: 12.3, h: 0.7,
      fontSize: 20,
      bold: true,
      color: WHITE,
      fontFace: TITLE_FONT,
    });

    if (hypotheses.length === 0) {
      slide.addText('No OpportunityAgent hypotheses have been generated for this value case yet.', {
        x: 0.5, y: 1.5, w: 12.3, h: 1,
        fontSize: 13,
        color: MUTED_TEXT,
        fontFace: BODY_FONT,
        italic: true,
      });
      return;
    }

    // Table header
    const TABLE_X = 0.4;
    const TABLE_Y = 1.1;
    const COL_WIDTHS = [5.2, 2.2, 2.0, 1.5]; // Hypothesis | Category | Impact | Confidence
    const ROW_H = 0.42;
    const HEADERS = ['Hypothesis', 'Category', 'Est. Impact', 'Confidence'];

    HEADERS.forEach((label, i) => {
      const x = TABLE_X + COL_WIDTHS.slice(0, i).reduce((a, b) => a + b, 0);
      slide.addShape(pptx.ShapeType.rect, {
        x, y: TABLE_Y, w: COL_WIDTHS[i], h: ROW_H,
        fill: { color: BRAND_ACCENT },
      });
      slide.addText(label, {
        x: x + 0.08, y: TABLE_Y + 0.06, w: (COL_WIDTHS[i] ?? 1) - 0.16, h: ROW_H - 0.1,
        fontSize: 10,
        bold: true,
        color: WHITE,
        fontFace: BODY_FONT,
      });
    });

    // Rows — cap at 8 to avoid overflow
    const rows = hypotheses.slice(0, 8);
    rows.forEach((h, rowIdx) => {
      const rowY = TABLE_Y + ROW_H + rowIdx * ROW_H;
      const isEven = rowIdx % 2 === 0;
      const rowBg = isEven ? 'F9FAFB' : WHITE;

      const title = h.title ?? h.description ?? '—';
      const category = h.category ?? '—';
      const impact = h.estimated_impact?.value != null
        ? `${h.estimated_impact.value.toLocaleString()} ${h.estimated_impact.unit ?? ''}`
        : '—';
      const confidence = h.confidence != null
        ? `${Math.round(h.confidence * 100)}%`
        : '—';

      const cells = [title, category, impact, confidence];

      cells.forEach((text, colIdx) => {
        const x = TABLE_X + COL_WIDTHS.slice(0, colIdx).reduce((a, b) => a + b, 0);
        slide.addShape(pptx.ShapeType.rect, {
          x, y: rowY, w: COL_WIDTHS[colIdx], h: ROW_H,
          fill: { color: rowBg },
          line: { color: 'E5E7EB', width: 0.5 },
        });
        slide.addText(text, {
          x: x + 0.08, y: rowY + 0.06, w: (COL_WIDTHS[colIdx] ?? 1) - 0.16, h: ROW_H - 0.1,
          fontSize: 9,
          color: DARK_TEXT,
          fontFace: BODY_FONT,
          wrap: true,
        });
      });
    });

    if (hypotheses.length > 8) {
      const footerY = TABLE_Y + ROW_H + rows.length * ROW_H + 0.1;
      slide.addText(`+ ${hypotheses.length - 8} more hypotheses not shown`, {
        x: TABLE_X, y: footerY, w: 12, h: 0.3,
        fontSize: 9,
        color: MUTED_TEXT,
        fontFace: BODY_FONT,
        italic: true,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: PptxExportService | null = null;

export function getPptxExportService(): PptxExportService {
  if (!_instance) {
    _instance = new PptxExportService();
  }
  return _instance;
}