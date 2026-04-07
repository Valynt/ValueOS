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

// service-role:justified worker/service requires elevated DB access for background processing
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
  private progressCallback?: (step: string, progress: number, message?: string) => Promise<void>;

  constructor(progressCallback?: (step: string, progress: number, message?: string) => Promise<void>) {
    this.supabase = createServerSupabaseClient();
    this.progressCallback = progressCallback;
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

    await this.emitProgress('launch', 50, 'Launching browser...');

    const pdfBuffer = await this.renderPdf(renderUrl, authToken, title);

    await this.emitProgress('launch', 100, 'Browser ready');

    logger.info('PdfExportService: uploading to storage', {
      caseId,
      storagePath,
      sizeBytes: pdfBuffer.length,
    });

    await this.emitProgress('upload', 50, 'Uploading to storage...');

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

    await this.emitProgress('upload', 100, 'Upload complete');
    await this.emitProgress('finalize', 50, 'Creating download link...');

    const { data: signedData, error: signError } = await this.supabase.storage
      .from(EXPORTS_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signError || !signedData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signError?.message ?? 'unknown'}`);
    }

    await this.emitProgress('finalize', 100, 'Export complete');

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
    type PuppeteerBrowser = {
      newPage: () => Promise<{
        setRequestInterception: (enabled: boolean) => Promise<void>;
        on: (event: string, handler: (req: unknown) => void) => void;
        setCookie: (cookie: Record<string, unknown>) => Promise<void>;
        goto: (url: string, options: Record<string, unknown>) => Promise<unknown>;
        waitForSelector: (selector: string, options: Record<string, unknown>) => Promise<unknown>;
        pdf: (options: Record<string, unknown>) => Promise<Buffer>;
      }>;
      close: () => Promise<void>;
    };
    let puppeteer: { default: { launch: (...args: unknown[]) => Promise<PuppeteerBrowser> } };
    try {
      // Use a variable to prevent tsc from resolving the module at compile time
      const moduleName = 'puppeteer';
      puppeteer = await import(/* @vite-ignore */ moduleName);
    } catch {
      throw new Error(
        'Puppeteer is not installed. Run: pnpm add -D puppeteer --filter @valueos/backend',
      );
    }

    const browser: PuppeteerBrowser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    // Allowlisted external resource types for PDF generation (fonts, images, CSS)
    // Block all other resource types to prevent data exfiltration or unwanted network access
    const ALLOWLISTED_RESOURCE_TYPES = new Set([
      'document',
      'stylesheet',
      'image',
      'font',
      'xhr',
      'fetch',
      'script',
    ]);

    // Blocked URL patterns that could be used for SSRF or local network access
    const BLOCKED_URL_PATTERNS = [
      /^file:/i,
      /^data:/i,
      /^javascript:/i,
      /^blob:/i,
      /^ws:/i,
      /^wss:/i,
      /^chrome-extension:/i,
      /127\.\d+\.\d+\.\d+/,
      /192\.168\.\d+\.\d+/,
      /10\.\d+\.\d+\.\d+/,
      /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
      /169\.254\.\d+\.\d+/, // Link-local
      /::1/,
      /localhost/i,
    ];

    try {
      const page = await browser.newPage();

      // Enable request interception to block SSRF attempts via redirects
      await page.setRequestInterception(true);

      page.on('request', (request: { resourceType: () => string; url: () => string; abort: () => void; continue: () => void }) => {
        const resourceType = request.resourceType();
        const requestUrl = request.url();

        // Block non-allowlisted resource types
        if (!ALLOWLISTED_RESOURCE_TYPES.has(resourceType)) {
          logger.warn('PdfExportService: blocked non-allowlisted resource type', {
            resourceType,
            url: requestUrl,
          });
          request.abort();
          return;
        }

        // Block requests to internal/private networks (SSRF protection)
        const isBlocked = BLOCKED_URL_PATTERNS.some(pattern => pattern.test(requestUrl));
        if (isBlocked) {
          logger.warn('PdfExportService: blocked potential SSRF request', {
            url: requestUrl,
          });
          request.abort();
          return;
        }

        request.continue();
      });

      await this.emitProgress('launch', 100, 'Browser launched');
      await this.emitProgress('render', 25, 'Loading page...');

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

      await this.emitProgress('render', 75, 'Waiting for content...');

      // Wait for the canvas content to fully render
      await page.waitForSelector('[data-pdf-ready]', { timeout: 10_000 }).catch(() => {
        // Selector is optional — proceed if not present
      });

      await this.emitProgress('generate', 50, 'Generating PDF...');

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:9px;color:#999;width:100%;text-align:center;">${title ?? 'ValueOS Export'}</div>`,
        footerTemplate: `<div style="font-size:9px;color:#999;width:100%;text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
      });

      await this.emitProgress('generate', 100, 'PDF generated');

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /**
   * Emit progress update if callback is configured.
   */
  private async emitProgress(step: string, progress: number, message?: string): Promise<void> {
    if (this.progressCallback) {
      await this.progressCallback(step, progress, message);
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
