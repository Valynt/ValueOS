"""
Async HTTP client with connection pooling and rate limiting.
"""

import asyncio
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential


class AsyncHTTPClient:
    """Async HTTP client with connection pooling and retry logic."""
    
    def __init__(
        self,
        timeout: float = 30.0,
        max_connections: int = 20,
        user_agent: str = "OntologyAgent/1.0"
    ):
        self.timeout = timeout
        self.max_connections = max_connections
        self.user_agent = user_agent
        self._client: Optional[httpx.AsyncClient] = None
        self._rate_limiters: dict[str, asyncio.Semaphore] = {}
    
    async def __aenter__(self):
        await self.start()
        return self
    
    async def __aexit__(self, *args):
        await self.close()
    
    async def start(self):
        """Initialize the HTTP client."""
        if self._client is None:
            limits = httpx.Limits(
                max_connections=self.max_connections,
                max_keepalive_connections=10
            )
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                limits=limits,
                headers={"User-Agent": self.user_agent},
                follow_redirects=True
            )
    
    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    def _get_domain(self, url: str) -> str:
        """Extract domain from URL for rate limiting."""
        parsed = urlparse(url)
        return parsed.netloc
    
    def _get_rate_limiter(self, domain: str, max_concurrent: int = 3) -> asyncio.Semaphore:
        """Get or create a rate limiter for a domain."""
        if domain not in self._rate_limiters:
            self._rate_limiters[domain] = asyncio.Semaphore(max_concurrent)
        return self._rate_limiters[domain]
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10)
    )
    async def get(
        self,
        url: str,
        headers: Optional[dict] = None,
        rate_limit: bool = True
    ) -> httpx.Response:
        """
        Make a GET request with optional rate limiting per domain.
        
        Args:
            url: The URL to fetch
            headers: Additional headers
            rate_limit: Whether to apply rate limiting
            
        Returns:
            The HTTP response
        """
        if self._client is None:
            await self.start()
        
        domain = self._get_domain(url)
        
        if rate_limit:
            limiter = self._get_rate_limiter(domain)
            async with limiter:
                return await self._client.get(url, headers=headers)
        else:
            return await self._client.get(url, headers=headers)
    
    async def get_text(self, url: str, **kwargs) -> str:
        """Get URL and return text content."""
        response = await self.get(url, **kwargs)
        response.raise_for_status()
        return response.text
    
    async def get_json(self, url: str, **kwargs) -> dict:
        """Get URL and return JSON content."""
        response = await self.get(url, **kwargs)
        response.raise_for_status()
        return response.json()


def normalize_url(base_url: str, href: str) -> str:
    """Normalize a URL by joining with base and removing fragments."""
    full_url = urljoin(base_url, href)
    parsed = urlparse(full_url)
    # Remove fragment
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


def is_same_domain(url1: str, url2: str) -> bool:
    """Check if two URLs belong to the same domain."""
    domain1 = urlparse(url1).netloc.lower()
    domain2 = urlparse(url2).netloc.lower()
    # Handle www prefix
    domain1 = domain1.removeprefix("www.")
    domain2 = domain2.removeprefix("www.")
    return domain1 == domain2
