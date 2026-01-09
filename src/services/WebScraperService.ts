import { logger } from '../lib/logger';

export interface WebScraperResult {
  url: string;
  title: string;
  h1_tags: string[];
  main_content: string;
  relevance_score: number;
}

export class WebScraperService {
  /**
   * Scrape a URL for its content
   */
  async scrape(url: string): Promise<WebScraperResult | null> {
    try {
      // Validate URL to prevent SSRF
      if (!this.isSafeUrl(url)) {
        logger.warn('Web scraping blocked for unsafe URL', { url });
        return null;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'ValueCanvasBot/1.0 (+http://valuecanvas.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const content = this.extractContent(html);

      return {
        url,
        title: content.title,
        h1_tags: content.h1s,
        main_content: content.text,
        relevance_score: 1.0 // Default score, as we specifically scraped this URL
      };

    } catch (error) {
      logger.warn('Web scraping failed', { url, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  private isSafeUrl(urlString: string): boolean {
    try {
      const url = new URL(urlString);

      // Block non-http protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        return false;
      }

      // Basic SSRF protection (block localhost/private IPs)
      // Note: A robust solution would require DNS resolution checks
      const hostname = url.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return false;
      }

      if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.endsWith('.local')) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract structured content from HTML using Regex
   * Note: This is a lightweight fallback when heavy parsers like Cheerio/JSDOM are not available/desirable.
   */
  private extractContent(html: string): { title: string; h1s: string[]; text: string } {
    // 1. Extract Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? this.cleanText(titleMatch[1]) : '';

    // 2. Extract H1s
    const h1s: string[] = [];
    const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
    let match;
    while ((match = h1Regex.exec(html)) !== null) {
      const h1Text = this.cleanText(match[1]);
      if (h1Text) {
        h1s.push(h1Text);
      }
    }

    // 3. Extract Main Content
    // First, remove irrelevant tags
    let text = html;

    // Remove scripts, styles, svg, head, noscript, iframe
    text = text.replace(/<(script|style|svg|head|noscript|iframe|nav|footer)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

    // Remove comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    // Remove all other tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Clean and normalize
    text = this.cleanText(text);

    return { title, h1s, text };
  }

  private cleanText(text: string): string {
    if (!text) return '';

    // Decode basic entities (very basic set)
    let cleaned = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }
}

export const webScraperService = new WebScraperService();
