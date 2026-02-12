/**
 * WebCrawler — same-domain crawler for onboarding research.
 *
 * Fetches the homepage + up to 10 linked pages on the same domain.
 * Total crawl time capped at 30 seconds. External domains are not followed.
 * Returns stripped text content capped at 50k characters.
 */

import { logger } from '../../lib/logger.js';

export interface CrawlResult {
  pages: CrawledPage[];
  totalChars: number;
  durationMs: number;
}

export interface CrawledPage {
  url: string;
  text: string;
}

const MAX_PAGES = 10;
const MAX_TOTAL_CHARS = 50_000;
const CRAWL_TIMEOUT_MS = 30_000;
const PAGE_FETCH_TIMEOUT_MS = 8_000;

/**
 * Strip HTML tags and collapse whitespace to extract readable text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract same-domain links from HTML.
 */
function extractLinks(html: string, baseUrl: URL): string[] {
  const linkRegex = /href=["']([^"']+)["']/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1]!, baseUrl);
      if (
        resolved.hostname === baseUrl.hostname &&
        resolved.protocol.startsWith('http') &&
        !resolved.pathname.match(/\.(pdf|png|jpg|jpeg|gif|svg|css|js|ico|woff|woff2|ttf|eot|mp4|mp3|zip|tar|gz)$/i) &&
        !links.includes(resolved.href)
      ) {
        links.push(resolved.href);
      }
    } catch {
      // Invalid URL — skip
    }
  }

  return links;
}

/**
 * Fetch a single page with timeout.
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ValueOS-Research/1.0 (onboarding crawler)',
        'Accept': 'text/html',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;

    return await response.text();
  } catch (err) {
    logger.warn('Page fetch failed', { url, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Crawl a website: homepage + up to MAX_PAGES same-domain linked pages.
 * Respects a total time budget of CRAWL_TIMEOUT_MS.
 */
export async function crawlWebsite(websiteUrl: string): Promise<CrawlResult> {
  const startTime = Date.now();
  const pages: CrawledPage[] = [];
  const visited = new Set<string>();

  let baseUrl: URL;
  try {
    baseUrl = new URL(websiteUrl);
  } catch {
    return { pages: [], totalChars: 0, durationMs: Date.now() - startTime };
  }

  // Normalize to homepage
  const homepageUrl = `${baseUrl.protocol}//${baseUrl.hostname}${baseUrl.pathname}`;
  const queue: string[] = [homepageUrl];
  let totalChars = 0;

  while (queue.length > 0 && pages.length < MAX_PAGES && totalChars < MAX_TOTAL_CHARS) {
    // Check time budget
    if (Date.now() - startTime > CRAWL_TIMEOUT_MS) {
      logger.info('Crawl time budget exceeded', { pagesCollected: pages.length });
      break;
    }

    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    const html = await fetchPage(url);
    if (!html) continue;

    const text = stripHtml(html);
    if (text.length < 50) continue; // Skip near-empty pages

    const remaining = MAX_TOTAL_CHARS - totalChars;
    const trimmedText = text.substring(0, remaining);

    pages.push({ url, text: trimmedText });
    totalChars += trimmedText.length;

    // Extract links from the first few pages to discover more content
    if (pages.length <= 3) {
      const links = extractLinks(html, baseUrl);
      for (const link of links) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }
    }
  }

  return {
    pages,
    totalChars,
    durationMs: Date.now() - startTime,
  };
}
