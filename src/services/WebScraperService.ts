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
      // Start with initial URL
      let currentUrl = url;
      let redirectCount = 0;
      const maxRedirects = 5;

      while (redirectCount <= maxRedirects) {
        // Validate URL to prevent SSRF
        if (!this.isSafeUrl(currentUrl)) {
          logger.warn('Web scraping blocked for unsafe URL', { url: currentUrl });
          return null;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        try {
          // Use manual redirect handling to check every hop
          const response = await fetch(currentUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'ValueCanvasBot/1.0 (+http://valuecanvas.com)',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            signal: controller.signal,
            redirect: 'manual'
          });

          clearTimeout(timeoutId);

          // Handle redirects manually
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('Location');
            if (!location) {
              throw new Error(`Redirect with no Location header (status ${response.status})`);
            }

            // Resolve relative URLs
            try {
              currentUrl = new URL(location, currentUrl).toString();
            } catch (e) {
              throw new Error(`Invalid redirect location: ${location}`);
            }

            redirectCount++;
            continue;
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }

          const html = await response.text();
          const content = this.extractContent(html);

          return {
            url: currentUrl,
            title: content.title,
            h1_tags: content.h1s,
            main_content: content.text,
            relevance_score: 1.0
          };

        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      }

      throw new Error(`Too many redirects (max ${maxRedirects})`);

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

      const hostname = url.hostname.toLowerCase();

      // 1. Block localhost and specific local domains
      if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.localhost')) {
        return false;
      }

      // 2. IPv6 Checks
      // Block ALL IPv6 literals.
      // Parsing IPv6 robustly without a library is error-prone.
      // Safe default: disallow direct IPv6 access (use domain names instead).
      if (hostname.startsWith('[') || hostname.includes(':')) {
        // Simple check for colon in hostname often indicates IPv6 literal (unbracketed in some contexts) or port?
        // URL.hostname usually strips port. If it has colon, it's IPv6.
        // But [::1] -> hostname is "[::1]" or "::1"?
        // In Node URL parser, brackets are kept in hostname for IPv6?
        // Let's verify: new URL('http://[::1]').hostname === '[::1]' in some envs, '::1' in others.
        // Safest is to block if it contains colon.
        return false;
      }

      // 3. IPv4 Checks
      // Check if hostname looks like an IP (starts with digit, or contains likely IP chars)
      // We block integer-only hostnames (http://2130706433) and hex/octal (http://0x7f...)
      const isIpLike = /^(\d+|0x[0-9a-f]+|0[0-7]+)(?:\.|$)/i.test(hostname);

      if (isIpLike) {
         // If it's an IP, we apply strict checks.

         // Block Integer IPs (no dots) - e.g. http://2130706433
         if (!hostname.includes('.')) return false;

         // Block Hex/Octal formats to prevent bypass
         // Valid IPs should be decimal dot notation: d.d.d.d
         const parts = hostname.split('.');
         // If any part looks like hex (0x) or octal (leading 0 but not just '0'), block it.
         if (parts.some(p => p.startsWith('0x') || (p.startsWith('0') && p.length > 1))) {
             return false;
         }

         // Check Private Ranges
         // 127.0.0.0/8
         if (hostname.startsWith('127.')) return false;
         // 10.0.0.0/8
         if (hostname.startsWith('10.')) return false;
         // 192.168.0.0/16
         if (hostname.startsWith('192.168.')) return false;
         // 169.254.0.0/16 (Link Local / Cloud Metadata)
         if (hostname.startsWith('169.254.')) return false;
         // 0.0.0.0/8
         if (hostname.startsWith('0.')) return false;

         // 172.16.0.0/12
         if (hostname.startsWith('172.')) {
             const secondOctet = parseInt(parts[1], 10);
             if (secondOctet >= 16 && secondOctet <= 31) return false;
         }
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
