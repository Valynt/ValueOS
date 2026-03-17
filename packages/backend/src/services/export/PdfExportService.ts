/**
 * PdfExportService
 *
 * Generates PDF exports of value cases and uploads them to Supabase Storage.
 * Returns a signed URL valid for 1 hour.
 *
 * PDF generation uses Puppeteer (headless Chrome). In environments where
 * Puppeteer is unavailable (dev without Chrome), falls back to an HTML
 * download with a clear error so callers can degrade gracefully.
 *
 * Bucket: "exports" (must exist in Supabase Storage with private access).
 * Path:   {organization_id}/value-cases/{case_id}/{timestamp}.pdf
 */

import { createLogger } from '@shared/lib/logger';
import { createServerSupabaseClient } from '../lib/supabase.js';

const logger = createLogger({ service: 'PdfExportService' });

const EXPORTS_BUCKET = 'exports';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PdfExportInput {
  organizationId: string;
  caseId: string;
  /** Fully-qualified URL of the page to render (internal, behind auth). */
  renderUrl: string;
  /** Optional auth cookie/token to pass to Puppeteer for authenticated pages. */
  authToken?: string;
  /** Page title used in the PDF metadata. */
  title?: string;
}

export interface PdfExportResult {
  /** Signed Supabase Storage URL, valid for 1 hour. */
  signedUrl: string;
  /** Storage path within the exports bucket. */
  storagePath: string;
  /** Size of the generated PDF in bytes. */
  sizeBytes: number;
  /** ISO timestamp of when the export was created. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PdfExportService {
  private supabase: ReturnType<typeof createServerSupabaseClient>;

  constructor() {
    this.supabase = createServerSupabaseClient();
  }

  /**
   * Generate a PDF for the given value case page and upload to Supabase Storage.
   * Returns a signed URL for the caller to redirect to or embed.
   */
  async exportValueCase(input: PdfExportInput): Promise<PdfExportResult> {
    const { organizationId, caseId, renderUrl, authToken, title } = input;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `${organizationId}/value-cases/${caseId}/${timestamp}.pdf`;

    logger.info('PdfExportService: generating PDF', { caseId, renderUrl });

    const pdfBuffer = await this.renderPdf(renderUrl, authToken, title);

    logger.info('PdfExportService: uploading to storage', {
      caseId,
      storagePath,
      sizeBytes: pdfBuffer.length,
    });

    const { error: uploadError } = await this.supabase.storage
      .from(EXPORTS_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      logger.error('PdfExportService: upload failed', {
        caseId,
        storagePath,
        error: uploadError.message,
      });
      throw new Error(`PDF upload failed: ${uploadError.message}`);
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
      sizeBytes: pdfBuffer.length,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Render a URL to PDF using Puppeteer (headless Chrome).
   *
   * Puppeteer is loaded dynamically so the service starts without it in
   * environments where Chrome is not available (CI, dev without --with-chrome).
   * Throws a descriptive error in that case so callers can fall back to HTML.
   */
  private async renderPdf(
    url: string,
    authToken: string | undefined,
    title: string | undefined,
  ): Promise<Buffer> {
    // Dynamic import keeps Puppeteer optional — the service starts without it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let puppeteer: any;
    try {
      // Use a variable to prevent tsc from resolving the module at compile time
      const moduleName = 'puppeteer';
      puppeteer = await import(/* @vite-ignore */ moduleName);
    } catch {
      throw new Error(
        'Puppeteer is not installed. Run: pnpm add -D puppeteer --filter @valueos/backend',
      );
    }

    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();

      // Inject auth token as a cookie if provided
      if (authToken) {
        const urlObj = new URL(url);
        await page.setCookie({
          name: 'sb-access-token',
          value: authToken,
          domain: urlObj.hostname,
          path: '/',
          httpOnly: true,
          secure: urlObj.protocol === 'https:',
        });
      }

      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });

      // Wait for the canvas content to fully render
      await page.waitForSelector('[data-pdf-ready]', { timeout: 10_000 }).catch(() => {
        // Selector is optional — proceed if not present
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:9px;color:#999;width:100%;text-align:center;">${title ?? 'ValueOS Export'}</div>`,
        footerTemplate: `<div style="font-size:9px;color:#999;width:100%;text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: PdfExportService | null = null;

export function getPdfExportService(): PdfExportService {
  if (!_instance) {
    _instance = new PdfExportService();
  }
  return _instance;
}
