"""
Website Crawler Agent.
Handles sitemap parsing, page crawling, JSON-LD extraction, and robots.txt compliance.
"""

import asyncio
import re
from typing import Optional
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree

from bs4 import BeautifulSoup
import json

from core.schemas import CrawledPage, SitemapInfo, TechStackInfo
from utils.http import AsyncHTTPClient, normalize_url, is_same_domain


class CrawlerAgent:
    """
    Async web crawler with intelligent page discovery.
    Prioritizes high-value pages (pricing, about, features, etc.)
    """
    
    # Priority pages to crawl (in order of importance)
    PRIORITY_PATHS = [
        "/",
        "/about",
        "/pricing",
        "/features",
        "/product",
        "/solutions",
        "/customers",
        "/integrations",
        "/security",
        "/company",
        "/team",
        "/contact",
    ]
    
    # Technology detection patterns
    TECH_PATTERNS = {
        "react": r"react|__NEXT_DATA__|_next",
        "vue": r"vue\.js|__vue__",
        "angular": r"ng-app|angular",
        "nextjs": r"__NEXT_DATA__|_next/static",
        "gatsby": r"gatsby",
        "wordpress": r"wp-content|wordpress",
        "shopify": r"shopify|cdn\.shopify",
        "hubspot": r"hubspot|hs-scripts",
        "intercom": r"intercom|widget\.intercom",
        "segment": r"segment\.io|analytics\.js",
        "google_analytics": r"google-analytics|gtag|ga\.js",
        "stripe": r"stripe\.com|js\.stripe",
        "cloudflare": r"cloudflare",
        "aws": r"amazonaws\.com|aws",
        "vercel": r"vercel|\.vercel\.app",
    }
    
    def __init__(self, http_client: Optional[AsyncHTTPClient] = None):
        self.http = http_client or AsyncHTTPClient()
        self._owns_http = http_client is None
    
    async def __aenter__(self):
        if self._owns_http:
            await self.http.start()
        return self
    
    async def __aexit__(self, *args):
        if self._owns_http:
            await self.http.close()
    
    async def crawl_website(
        self, 
        url: str, 
        max_pages: int = 15,
        include_sitemap: bool = True
    ) -> dict:
        """
        Crawl a website and extract relevant data.
        
        Args:
            url: The base URL to crawl
            max_pages: Maximum number of pages to crawl
            include_sitemap: Whether to parse sitemap.xml
            
        Returns:
            Dict with crawled pages, sitemap info, and tech stack
        """
        base_url = self._normalize_base_url(url)
        results = {
            "base_url": base_url,
            "pages": [],
            "sitemap": None,
            "tech_stack": None,
            "robots_txt": None
        }
        
        # Crawl in parallel
        tasks = [
            self._crawl_priority_pages(base_url, max_pages),
            self._parse_sitemap(base_url) if include_sitemap else asyncio.sleep(0),
            self._check_robots_txt(base_url),
        ]
        
        crawl_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        if not isinstance(crawl_results[0], Exception):
            results["pages"] = crawl_results[0]
        
        if include_sitemap and not isinstance(crawl_results[1], Exception):
            results["sitemap"] = crawl_results[1]
        
        if not isinstance(crawl_results[2], Exception):
            results["robots_txt"] = crawl_results[2]
        
        # Detect tech stack from crawled pages
        if results["pages"]:
            results["tech_stack"] = self._detect_tech_stack(results["pages"])
        
        return results
    
    async def _crawl_priority_pages(
        self, 
        base_url: str, 
        max_pages: int
    ) -> list[CrawledPage]:
        """Crawl priority pages first, then discover more."""
        crawled = []
        crawled_urls = set()
        
        # Build priority URL list
        priority_urls = [urljoin(base_url, path) for path in self.PRIORITY_PATHS]
        
        # Crawl priority pages
        for url in priority_urls[:max_pages]:
            if url in crawled_urls:
                continue
            
            page = await self._crawl_page(url)
            if page:
                crawled.append(page)
                crawled_urls.add(url)
        
        return crawled
    
    async def _crawl_page(self, url: str) -> Optional[CrawledPage]:
        """Crawl a single page and extract data."""
        try:
            html = await self.http.get_text(url)
            soup = BeautifulSoup(html, "lxml")
            
            # Extract title
            title = None
            if soup.title:
                title = soup.title.string
            
            # Extract main content (remove scripts, styles, nav, footer)
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            
            content = soup.get_text(separator=" ", strip=True)
            content = re.sub(r"\s+", " ", content)[:10000]  # Limit content size
            
            # Extract JSON-LD structured data
            json_ld = self._extract_json_ld(soup)
            
            # Extract meta tags
            meta_tags = self._extract_meta_tags(soup)
            
            # Extract links
            links = self._extract_links(soup, url)
            
            return CrawledPage(
                url=url,
                title=title,
                content=content,
                json_ld=json_ld,
                meta_tags=meta_tags,
                links=links
            )
            
        except Exception as e:
            print(f"Failed to crawl {url}: {e}")
            return None
    
    def _extract_json_ld(self, soup: BeautifulSoup) -> list[dict]:
        """Extract JSON-LD structured data from page."""
        json_ld_data = []
        
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string)
                if isinstance(data, list):
                    json_ld_data.extend(data)
                else:
                    json_ld_data.append(data)
            except:
                pass
        
        return json_ld_data
    
    def _extract_meta_tags(self, soup: BeautifulSoup) -> dict[str, str]:
        """Extract relevant meta tags."""
        meta = {}
        
        for tag in soup.find_all("meta"):
            name = tag.get("name") or tag.get("property", "")
            content = tag.get("content", "")
            
            if name and content:
                # Focus on relevant meta tags
                if any(k in name.lower() for k in ["description", "og:", "twitter:", "keywords"]):
                    meta[name] = content
        
        return meta
    
    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        """Extract internal links from page."""
        links = set()
        
        for a in soup.find_all("a", href=True):
            href = a["href"]
            full_url = normalize_url(base_url, href)
            
            if is_same_domain(base_url, full_url):
                links.add(full_url)
        
        return list(links)[:50]  # Limit links
    
    async def _parse_sitemap(self, base_url: str) -> SitemapInfo:
        """Parse sitemap.xml to discover all pages."""
        sitemap_urls = [
            urljoin(base_url, "/sitemap.xml"),
            urljoin(base_url, "/sitemap_index.xml"),
        ]
        
        info = SitemapInfo()
        
        for sitemap_url in sitemap_urls:
            try:
                xml = await self.http.get_text(sitemap_url)
                root = ElementTree.fromstring(xml)
                
                # Handle sitemap index
                ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
                
                # Extract URLs
                for loc in root.findall(".//sm:loc", ns):
                    url = loc.text
                    if url:
                        info.urls.append(url)
                        
                        # Detect page types
                        if "/blog" in url:
                            info.has_blog = True
                        if "/docs" in url or "/documentation" in url:
                            info.has_docs = True
                        if "/pricing" in url:
                            info.has_pricing = True
                
                info.url_count = len(info.urls)
                break  # Successfully parsed
                
            except:
                continue
        
        return info
    
    async def _check_robots_txt(self, base_url: str) -> Optional[str]:
        """Fetch robots.txt for compliance."""
        try:
            robots_url = urljoin(base_url, "/robots.txt")
            return await self.http.get_text(robots_url)
        except:
            return None
    
    def _detect_tech_stack(self, pages: list[CrawledPage]) -> TechStackInfo:
        """Detect technologies from crawled HTML."""
        tech = TechStackInfo()
        
        # Combine all page content for analysis
        all_content = " ".join(p.content for p in pages)
        
        for tech_name, pattern in self.TECH_PATTERNS.items():
            if re.search(pattern, all_content, re.IGNORECASE):
                if tech_name in ["cloudflare", "aws", "vercel"]:
                    tech.hosting = tech_name
                elif tech_name in ["google_analytics", "segment"]:
                    tech.analytics.append(tech_name)
                elif tech_name in ["react", "vue", "angular", "nextjs", "gatsby"]:
                    tech.frameworks.append(tech_name)
                else:
                    tech.technologies.append(tech_name)
        
        return tech
    
    def _normalize_base_url(self, url: str) -> str:
        """Ensure URL has scheme and no trailing slash."""
        if not url.startswith(("http://", "https://")):
            url = f"https://{url}"
        return url.rstrip("/")
