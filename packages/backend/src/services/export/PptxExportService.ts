/**
 * PptxExportService
 *
 * Generates a PPTX presentation for a value case using pptxgenjs.
 * Reads from: narrative_drafts, value_tree_nodes, integrity_outputs,
 * financial_model_snapshots. Missing stage data produces a placeholder slide.
 *
 * All DB reads are scoped to organizationId (tenant isolation).
 */

import { createLogger } from '@shared/lib/logger';
import PptxGenJS from 'pptxgenjs';

import { FinancialModelSnapshotRepository } from '../../repositories/FinancialModelSnapshotRepository.js';
import { IntegrityResultRepository } from '../../repositories/IntegrityResultRepository.js';
import { NarrativeDraftRepository } from '../../repositories/NarrativeDraftRepository.js';
import { ValueTreeRepository } from '../../repositories/ValueTreeRepository.js';

const logger = createLogger({ component: 'PptxExportService' });

// Slide dimensions (widescreen 16:9)
const SLIDE_W = 10;
const SLIDE_H = 5.625;

// Brand colours
const COLOR_PRIMARY = '1A1A2E';
const COLOR_ACCENT = '4F8EF7';
const COLOR_TEXT = 'F0F0F0';
const COLOR_MUTED = 'A0A0B0';
const COLOR_BG = '16213E';

export interface PptxExportInput {
  caseId: string;
  organizationId: string;
  caseTitle?: string;
}

export class PptxExportService {
  private narrativeRepo: NarrativeDraftRepository;
  private valueTreeRepo: ValueTreeRepository;
  private integrityRepo: IntegrityResultRepository;
  private financialRepo: FinancialModelSnapshotRepository;

  constructor() {
    this.narrativeRepo = new NarrativeDraftRepository();
    this.valueTreeRepo = new ValueTreeRepository();
    this.integrityRepo = new IntegrityResultRepository();
    this.financialRepo = new FinancialModelSnapshotRepository();
  }

  async generatePptx(input: PptxExportInput): Promise<Buffer> {
    const { caseId, organizationId, caseTitle = 'Value Case' } = input;

    logger.info('PptxExportService: generating', { caseId, organizationId });

    // Fetch all stage data in parallel — missing data is handled per-slide
    const [narrative, treeNodes, integrity, financial] = await Promise.all([
      this.narrativeRepo.getLatestForCase(caseId, organizationId).catch(() => null),
      this.valueTreeRepo.getNodesForCase(caseId, organizationId).catch(() => []),
      this.integrityRepo.getLatestForCase(caseId, organizationId).catch(() => null),
      this.financialRepo.getLatestSnapshotForCase(caseId, organizationId).catch(() => null),
    ]);

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'ValueOS';
    pptx.subject = caseTitle;

    this.addTitleSlide(pptx, caseTitle, caseId);
    this.addExecutiveSummarySlide(pptx, narrative);
    this.addValueTreeSlide(pptx, treeNodes ?? []);
    this.addFinancialSlide(pptx, financial);
    this.addIntegritySlide(pptx, integrity);

    const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    logger.info('PptxExportService: generated', { caseId, bytes: buffer.length });
    return buffer;
  }

  // ── Slides ────────────────────────────────────────────────────────────────

  private addTitleSlide(pptx: PptxGenJS, title: string, caseId: string): void {
    const slide = pptx.addSlide();
    slide.background = { color: COLOR_BG };

    slide.addText(title, {
      x: 0.5, y: 1.5, w: SLIDE_W - 1, h: 1.2,
      fontSize: 36, bold: true, color: COLOR_TEXT, align: 'center',
    });
    slide.addText('Value Engineering Case', {
      x: 0.5, y: 2.8, w: SLIDE_W - 1, h: 0.5,
      fontSize: 18, color: COLOR_ACCENT, align: 'center',
    });
    slide.addText(`Case ID: ${caseId}`, {
      x: 0.5, y: SLIDE_H - 0.6, w: SLIDE_W - 1, h: 0.3,
      fontSize: 10, color: COLOR_MUTED, align: 'center',
    });
    slide.addText(`Generated ${new Date().toLocaleDateString()}`, {
      x: 0.5, y: SLIDE_H - 0.35, w: SLIDE_W - 1, h: 0.3,
      fontSize: 10, color: COLOR_MUTED, align: 'center',
    });
  }

  private addExecutiveSummarySlide(pptx: PptxGenJS, narrative: unknown): void {
    const slide = pptx.addSlide();
    slide.background = { color: COLOR_BG };
    this.addSlideHeader(slide, 'Executive Summary');

    const summary = this.extractNarrativeSummary(narrative);
    slide.addText(summary, {
      x: 0.5, y: 1.2, w: SLIDE_W - 1, h: SLIDE_H - 1.8,
      fontSize: 14, color: COLOR_TEXT, valign: 'top', wrap: true,
    });
  }

  private addValueTreeSlide(pptx: PptxGenJS, nodes: unknown[]): void {
    const slide = pptx.addSlide();
    slide.background = { color: COLOR_BG };
    this.addSlideHeader(slide, 'Value Tree');

    if (!nodes || nodes.length === 0) {
      this.addPlaceholder(slide, 'Value tree not yet generated for this case.');
      return;
    }

    const rows = (nodes as Array<Record<string, unknown>>).slice(0, 8).map((n) => [
      { text: String(n['node_key'] ?? n['label'] ?? '—'), options: { color: COLOR_TEXT, fontSize: 11 } },
      { text: String(n['value_type'] ?? '—'), options: { color: COLOR_MUTED, fontSize: 11 } },
      { text: n['estimated_value'] != null ? `$${Number(n['estimated_value']).toLocaleString()}` : '—', options: { color: COLOR_ACCENT, fontSize: 11, bold: true } },
    ]);

    slide.addTable(
      [
        [
          { text: 'Driver', options: { bold: true, color: COLOR_ACCENT, fontSize: 12 } },
          { text: 'Type', options: { bold: true, color: COLOR_ACCENT, fontSize: 12 } },
          { text: 'Est. Value', options: { bold: true, color: COLOR_ACCENT, fontSize: 12 } },
        ],
        ...rows,
      ],
      { x: 0.5, y: 1.2, w: SLIDE_W - 1, colW: [4.5, 2, 2.5], fill: { color: COLOR_PRIMARY }, border: { type: 'none' } }
    );
  }

  private addFinancialSlide(pptx: PptxGenJS, snapshot: unknown): void {
    const slide = pptx.addSlide();
    slide.background = { color: COLOR_BG };
    this.addSlideHeader(slide, 'Financial Model');

    if (!snapshot) {
      this.addPlaceholder(slide, 'Financial model not yet generated for this case.');
      return;
    }

    const s = snapshot as Record<string, unknown>;
    const metrics = [
      ['Total Value', s['total_value'] != null ? `$${Number(s['total_value']).toLocaleString()}` : '—'],
      ['ROI', s['roi'] != null ? `${(Number(s['roi']) * 100).toFixed(1)}%` : '—'],
      ['NPV', s['npv'] != null ? `$${Number(s['npv']).toLocaleString()}` : '—'],
      ['Payback Period', s['payback_period_months'] != null ? `${s['payback_period_months']} months` : '—'],
      ['Confidence', s['confidence'] != null ? `${(Number(s['confidence']) * 100).toFixed(0)}%` : '—'],
    ];

    metrics.forEach(([label, value], i) => {
      const y = 1.3 + i * 0.65;
      slide.addText(`${label}:`, { x: 0.8, y, w: 3, h: 0.5, fontSize: 13, color: COLOR_MUTED });
      slide.addText(String(value), { x: 3.8, y, w: 5, h: 0.5, fontSize: 13, bold: true, color: COLOR_TEXT });
    });
  }

  private addIntegritySlide(pptx: PptxGenJS, integrity: unknown): void {
    const slide = pptx.addSlide();
    slide.background = { color: COLOR_BG };
    this.addSlideHeader(slide, 'Integrity Scorecard');

    if (!integrity) {
      this.addPlaceholder(slide, 'Integrity validation not yet run for this case.');
      return;
    }

    const r = integrity as Record<string, unknown>;
    const verdict = String(r['overall_verdict'] ?? r['verdict'] ?? '—').toUpperCase();
    const score = r['overall_score'] ?? r['score'];
    const scoreText = score != null ? `${(Number(score) * 100).toFixed(0)}%` : '—';
    const verdictColor = verdict === 'APPROVED' ? '4CAF50' : verdict === 'REJECTED' ? 'F44336' : 'FF9800';

    slide.addText(verdict, {
      x: 0.5, y: 1.3, w: SLIDE_W - 1, h: 0.8,
      fontSize: 28, bold: true, color: verdictColor, align: 'center',
    });
    slide.addText(`Overall Score: ${scoreText}`, {
      x: 0.5, y: 2.2, w: SLIDE_W - 1, h: 0.5,
      fontSize: 16, color: COLOR_TEXT, align: 'center',
    });

    const summary = String(r['overall_assessment'] ?? r['summary'] ?? 'No assessment available.');
    slide.addText(summary, {
      x: 0.8, y: 2.9, w: SLIDE_W - 1.6, h: 1.8,
      fontSize: 12, color: COLOR_MUTED, wrap: true,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private addSlideHeader(slide: PptxGenJS.Slide, title: string): void {
    slide.addText(title, {
      x: 0, y: 0, w: SLIDE_W, h: 0.9,
      fontSize: 20, bold: true, color: COLOR_TEXT,
      fill: { color: COLOR_PRIMARY }, align: 'center', valign: 'middle',
    });
  }

  private addPlaceholder(slide: PptxGenJS.Slide, message: string): void {
    slide.addText(message, {
      x: 0.5, y: 2.2, w: SLIDE_W - 1, h: 1,
      fontSize: 14, color: COLOR_MUTED, align: 'center', italic: true,
    });
  }

  private extractNarrativeSummary(narrative: unknown): string {
    if (!narrative) return 'Executive summary not yet generated for this case.';
    const n = narrative as Record<string, unknown>;
    if (typeof n['executive_summary'] === 'string') return n['executive_summary'];
    if (typeof n['summary'] === 'string') return n['summary'];
    const sections = n['sections'] as Array<Record<string, unknown>> | undefined;
    if (sections?.length) return String(sections[0]?.['content'] ?? 'No summary available.');
    return 'No summary available.';
  }
}

let _instance: PptxExportService | null = null;
export function getPptxExportService(): PptxExportService {
  if (!_instance) _instance = new PptxExportService();
  return _instance;
}
