"""
Data Enricher Agent.
Gathers additional data from external sources: GitHub, News, DNS.
"""

import asyncio
import re
from typing import Optional
from urllib.parse import urlparse

import dns.resolver

from utils.http import AsyncHTTPClient


class EnricherAgent:
    """
    Enriches company data from external sources.
    Uses safe, publicly available APIs only.
    """
    
    # News search via DuckDuckGo (no API key needed)
    DDGO_SEARCH_URL = "https://html.duckduckgo.com/html/"
    
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
    
    async def enrich(self, domain: str, company_name: Optional[str] = None) -> dict:
        """
        Gather enrichment data from multiple sources in parallel.
        
        Args:
            domain: The company's domain
            company_name: Optional company name for search
            
        Returns:
            Dict with enrichment data from various sources
        """
        # Run all enrichment tasks in parallel
        tasks = {
            "dns": self._get_dns_info(domain),
            "github": self._search_github(domain, company_name),
            "news": self._search_news(company_name or domain),
        }
        
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        
        enrichment = {}
        for key, result in zip(tasks.keys(), results):
            if not isinstance(result, Exception):
                enrichment[key] = result
            else:
                enrichment[key] = None
        
        return enrichment
    
    async def _get_dns_info(self, domain: str) -> dict:
        """Get DNS information for the domain."""
        info = {
            "domain": domain,
            "mx_records": [],
            "txt_records": [],
            "has_spf": False,
            "has_dmarc": False,
            "email_provider": None,
        }
        
        try:
            # MX records - reveals email provider
            try:
                mx_records = dns.resolver.resolve(domain, "MX")
                for record in mx_records:
                    mx = str(record.exchange).rstrip(".")
                    info["mx_records"].append(mx)
                    
                    # Detect email provider
                    if "google" in mx.lower():
                        info["email_provider"] = "Google Workspace"
                    elif "outlook" in mx.lower() or "microsoft" in mx.lower():
                        info["email_provider"] = "Microsoft 365"
            except:
                pass
            
            # TXT records - reveals security posture
            try:
                txt_records = dns.resolver.resolve(domain, "TXT")
                for record in txt_records:
                    txt = str(record)
                    info["txt_records"].append(txt)
                    
                    if "v=spf1" in txt:
                        info["has_spf"] = True
            except:
                pass
            
            # DMARC
            try:
                dmarc_records = dns.resolver.resolve(f"_dmarc.{domain}", "TXT")
                if dmarc_records:
                    info["has_dmarc"] = True
            except:
                pass
                
        except Exception as e:
            info["error"] = str(e)
        
        return info
    
    async def _search_github(
        self, 
        domain: str, 
        company_name: Optional[str] = None
    ) -> dict:
        """Search for company's GitHub organization."""
        info = {
            "organization": None,
            "repos": [],
            "languages": [],
            "total_stars": 0,
        }
        
        try:
            # Try to find org by domain or company name
            search_terms = [domain.split(".")[0]]
            if company_name:
                search_terms.append(company_name.lower().replace(" ", ""))
            
            for term in search_terms:
                try:
                    # GitHub API (unauthenticated has rate limits but works for MVP)
                    org_url = f"https://api.github.com/orgs/{term}"
                    response = await self.http.get(org_url)
                    
                    if response.status_code == 200:
                        org_data = response.json()
                        info["organization"] = {
                            "login": org_data.get("login"),
                            "name": org_data.get("name"),
                            "description": org_data.get("description"),
                            "public_repos": org_data.get("public_repos", 0),
                            "followers": org_data.get("followers", 0),
                            "url": org_data.get("html_url"),
                        }
                        
                        # Get top repos
                        repos_url = f"https://api.github.com/orgs/{term}/repos?sort=stars&per_page=5"
                        repos_response = await self.http.get(repos_url)
                        
                        if repos_response.status_code == 200:
                            repos = repos_response.json()
                            for repo in repos:
                                info["repos"].append({
                                    "name": repo.get("name"),
                                    "description": repo.get("description"),
                                    "stars": repo.get("stargazers_count", 0),
                                    "language": repo.get("language"),
                                })
                                
                                if repo.get("language"):
                                    if repo["language"] not in info["languages"]:
                                        info["languages"].append(repo["language"])
                                
                                info["total_stars"] += repo.get("stargazers_count", 0)
                        
                        break  # Found org, stop searching
                        
                except:
                    continue
                    
        except Exception as e:
            info["error"] = str(e)
        
        return info
    
    async def _search_news(self, query: str) -> dict:
        """Search for recent news about the company."""
        info = {
            "articles": [],
            "query": query,
        }
        
        try:
            # Use DuckDuckGo HTML search (no API key needed)
            # Note: This is for MVP - production should use proper news API
            search_url = f"https://duckduckgo.com/html/?q={query}+news"
            
            response = await self.http.get(search_url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; OntologyAgent/1.0)"
            })
            
            if response.status_code == 200:
                # Parse search results (simplified)
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(response.text, "lxml")
                
                for result in soup.select(".result")[:5]:
                    title_elem = result.select_one(".result__title")
                    snippet_elem = result.select_one(".result__snippet")
                    link_elem = result.select_one(".result__url")
                    
                    if title_elem:
                        info["articles"].append({
                            "title": title_elem.get_text(strip=True),
                            "snippet": snippet_elem.get_text(strip=True) if snippet_elem else "",
                            "url": link_elem.get_text(strip=True) if link_elem else "",
                        })
                        
        except Exception as e:
            info["error"] = str(e)
        
        return info
