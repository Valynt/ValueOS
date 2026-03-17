/**
 * WebCrawler — same-domain crawler for onboarding research.
 *
 * Delegates page fetching to WebScraperService (cheerio-based, SSRF-protected)
 * instead of raw fetch + regex HTML stripping.
 *
 * Fetches the homepage + up to 10 linked pages on the same domain.
 * Total crawl time capped at 30 seconds. External domains are not followed.
 * Returns stripped text content capped at 50k characters.
 */

import { logger } from '../../lib/logger.js';
import { type WebScraperResult, WebScraperService } from '../WebScraperService.js';

// ---------------------------------------------------------------------------
// Public types (unchanged — consumed by ResearchJobWorker + SuggestionExtractor)
// ---------------------------------------------------------------------------

export interface CrawlResult {
  pages: CrawledPage[];
  totalChars: number;
  durationMs: number;
}

export interface CrawledPage {
  url: string;
  text: string;
  title?: string;
  /** Raw HTML or markdown content — alias for text used by some callers. */
  content?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PAGES = 10;
const MAX_TOTAL_CHARS = 50_000;
const CRAWL_TIMEOUT_MS = 30_000;

// Shared scraper instance — reuses its internal cache and rate limiter
const scraper = new WebScraperService(
  'ValueOS-Research/1.0 (onboarding crawler)',
);

// ---------------------------------------------------------------------------
// Link extraction (lightweight — runs on raw HTML fetched separately)
// ---------------------------------------------------------------------------

/**
 * Fetch raw HTML for link discovery only. We use the scraper for content
 * extraction but need the raw HTML to find same-domain links.
 */
async function fetchRawHtml(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ValueOS-Research/1.0 (onboarding crawler)',
        Accept: 'text/html',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;

    return await response.text();
  } catch {
    return null;
  }
}

function extractSameDomainLinks(html: string, baseUrl: URL): string[] {
  const linkRegex = /href=["']([^"']+)["']/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1]!, baseUrl);
      if (
        resolved.hostname === baseUrl.hostname &&
        resolved.protocol.startsWith('http') &&
        !resolved.pathname.match(
          /\.(pdf|png|jpg|jpeg|gif|svg|css|js|ico|woff|woff2|ttf|eot|mp4|mp3|zip|tar|gz)$/i,
        ) &&
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLinkScore(url: string): number {
  const path = url.toLowerCase();
  if (path.includes('/product')) return 100;
  if (path.includes('/solution')) return 90;
  if (path.includes('/pricing')) return 80;
  if (path.includes('/platform')) return 70;
  if (path.includes('/capability')) return 60;
  if (path.includes('/about')) return 50;
  if (path.includes('/company')) return 40;
  if (path.includes('/resource')) return 30;
  return 0;
}

interface ScoredLink {
  url: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Main crawl function
// ---------------------------------------------------------------------------

/**
 * Crawl a website: homepage + up to MAX_PAGES same-domain linked pages.
 * Uses WebScraperService for content extraction (cheerio, SSRF protection).
 * Prioritizes high-value paths like /products and /solutions.
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

  const homepageUrl = `${baseUrl.protocol}//${baseUrl.hostname}${baseUrl.pathname}`;
  const queue: ScoredLink[] = [{ url: homepageUrl, score: 1000 }]; // Homepage always first
  let totalChars = 0;

  while (queue.length > 0 && pages.length < MAX_PAGES && totalChars < MAX_TOTAL_CHARS) {
    if (Date.now() - startTime > CRAWL_TIMEOUT_MS) {
      logger.info('Crawl time budget exceeded', { pagesCollected: pages.length });
      break;
    }

    // Sort queue by score (descending) and pick the best one
    queue.sort((a, b) => b.score - a.score);
    const { url } = queue.shift()!;
    
    if (visited.has(url)) continue;
    visited.add(url);

    logger.debug('Crawling URL', { url, score: getLinkScore(url) });

    // Use the production scraper for content extraction
    const result: WebScraperResult | null = await scraper.scrape(url, 1);
    if (!result || result.main_content.length < 50) continue;

    // Combine title + h1s + main content for richer text
    const textParts = [
      result.title,
      ...result.h1_tags,
      result.main_content,
    ].filter(Boolean);
    const fullText = textParts.join('\n\n');

    const remaining = MAX_TOTAL_CHARS - totalChars;
    const trimmedText = fullText.substring(0, remaining);

    pages.push({ url, text: trimmedText });
    totalChars += trimmedText.length;

    // Discover links and add to queue with scores
    const html = await fetchRawHtml(url, 5_000);
    if (html) {
      const links = extractSameDomainLinks(html, baseUrl);
      for (const link of links) {
        if (!visited.has(link) && !queue.find(q => q.url === link)) {
          queue.push({ url: link, score: getLinkScore(link) });
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
