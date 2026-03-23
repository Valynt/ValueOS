"""
Orchestrator Agent.
Coordinates all sub-agents and manages the complete discovery pipeline.
"""

import asyncio
from datetime import datetime
from typing import Callable, Optional
from urllib.parse import urlparse

from core.schemas import (
    Entity,
    EntityType,
    Relationship,
    RelationType,
    Insight,
    InsightType,
    InsightSeverity,
    KnowledgeGraph,
    JobStatus,
)
from agents.crawler import CrawlerAgent
from agents.enricher import EnricherAgent
from agents.extractor import ExtractorAgent
from utils.http import AsyncHTTPClient


ProgressCallback = Callable[[JobStatus, float, str], None]


class OntologyOrchestrator:
    """
    Master orchestrator that coordinates the ontology discovery pipeline.
    
    Pipeline:
    1. Crawl website (parallel: pages, sitemap, robots)
    2. Enrich from external sources (parallel: DNS, GitHub, news)
    3. Extract entities and relationships
    4. Build knowledge graph
    5. Generate insights
    """
    
    def __init__(self):
        self.http_client = AsyncHTTPClient()
    
    async def discover(
        self,
        url: str,
        competitor_urls: list[str] = None,
        industry_hints: list[str] = None,
        progress_callback: Optional[ProgressCallback] = None
    ) -> dict:
        """
        Run the complete ontology discovery pipeline.
        
        Args:
            url: Target company URL
            competitor_urls: Optional list of competitor URLs
            industry_hints: Optional industry context hints
            progress_callback: Async callback for progress updates
            
        Returns:
            Dict with graph, insights, and metadata
        """
        competitor_urls = competitor_urls or []
        industry_hints = industry_hints or []
        
        start_time = datetime.utcnow()
        warnings = []
        
        async with self.http_client:
            # Initialize agents
            crawler = CrawlerAgent(self.http_client)
            enricher = EnricherAgent(self.http_client)
            extractor = ExtractorAgent()
            
            domain = urlparse(url).netloc.removeprefix("www.")
            
            # =========================================================
            # Phase 1: CRAWLING (parallel)
            # =========================================================
            if progress_callback:
                await progress_callback(
                    JobStatus.CRAWLING, 0.1, 
                    f"Crawling {domain}..."
                )
            
            # Crawl main site and competitors in parallel
            crawl_tasks = [crawler.crawl_website(url)]
            for comp_url in competitor_urls[:3]:  # Limit competitors
                crawl_tasks.append(crawler.crawl_website(comp_url))
            
            crawl_results = await asyncio.gather(*crawl_tasks, return_exceptions=True)
            
            main_crawl = crawl_results[0] if not isinstance(crawl_results[0], Exception) else {}
            competitor_crawls = [
                r for r in crawl_results[1:] 
                if not isinstance(r, Exception)
            ]
            
            sources_crawled = len(main_crawl.get("pages", []))
            
            if progress_callback:
                await progress_callback(
                    JobStatus.CRAWLING, 0.3,
                    f"Crawled {sources_crawled} pages, enriching data...",
                    entities_found=0
                )
            
            # =========================================================
            # Phase 2: ENRICHMENT (parallel with extraction)
            # =========================================================
            enrichment_task = enricher.enrich(
                domain, 
                company_name=self._extract_company_name(main_crawl)
            )
            
            # =========================================================
            # Phase 3: EXTRACTION
            # =========================================================
            if progress_callback:
                await progress_callback(
                    JobStatus.EXTRACTING, 0.4,
                    "Extracting entities and relationships..."
                )
            
            pages = main_crawl.get("pages", [])
            
            # Run extraction and enrichment in parallel
            extraction_task = extractor.extract_from_pages(pages, use_llm=True)
            
            extraction_result, enrichment_data = await asyncio.gather(
                extraction_task,
                enrichment_task,
                return_exceptions=True
            )
            
            # Handle results
            if isinstance(extraction_result, Exception):
                warnings.append(f"Extraction error: {extraction_result}")
                entities, relationships = [], []
            else:
                entities, relationships = extraction_result
            
            if isinstance(enrichment_data, Exception):
                warnings.append(f"Enrichment error: {enrichment_data}")
                enrichment_data = {}
            
            # =========================================================
            # Phase 4: BUILD KNOWLEDGE GRAPH
            # =========================================================
            if progress_callback:
                await progress_callback(
                    JobStatus.BUILDING_GRAPH, 0.6,
                    f"Building knowledge graph with {len(entities)} entities...",
                    entities_found=len(entities)
                )
            
            # Add enrichment-derived entities
            enriched_entities = self._entities_from_enrichment(
                enrichment_data, domain
            )
            entities.extend(enriched_entities)
            
            # Add tech stack entities
            tech_stack = main_crawl.get("tech_stack")
            if tech_stack:
                tech_entities = self._entities_from_tech_stack(tech_stack)
                entities.extend(tech_entities)
            
            # Create knowledge graph
            graph = KnowledgeGraph(
                entities=entities,
                relationships=relationships
            )
            
            # =========================================================
            # Phase 5: GENERATE INSIGHTS
            # =========================================================
            if progress_callback:
                await progress_callback(
                    JobStatus.GENERATING_INSIGHTS, 0.8,
                    "Generating insights...",
                    entities_found=len(entities),
                    relationships_found=len(relationships)
                )
            
            insights = self._generate_insights(
                graph, 
                enrichment_data, 
                main_crawl,
                competitor_crawls
            )
            
            # =========================================================
            # COMPLETE
            # =========================================================
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            return {
                "graph": graph,
                "insights": insights,
                "sources_crawled": sources_crawled,
                "processing_time": processing_time,
                "warnings": warnings,
                "enrichment": enrichment_data,
            }
    
    def _extract_company_name(self, crawl_data: dict) -> Optional[str]:
        """Extract company name from crawled data."""
        pages = crawl_data.get("pages", [])
        
        for page in pages:
            # Try JSON-LD first
            for ld in page.json_ld:
                if ld.get("@type") in ["Organization", "Corporation"]:
                    return ld.get("name")
            
            # Try meta tags
            if "og:site_name" in page.meta_tags:
                return page.meta_tags["og:site_name"]
        
        return None
    
    def _entities_from_enrichment(
        self, 
        enrichment: dict, 
        domain: str
    ) -> list[Entity]:
        """Create entities from enrichment data."""
        entities = []
        
        # GitHub entities
        github = enrichment.get("github", {})
        if github.get("organization"):
            org = github["organization"]
            entities.append(Entity(
                id=f"github_{org.get('login', 'unknown')}",
                type=EntityType.ORGANIZATION,
                name=org.get("name") or org.get("login"),
                description=org.get("description"),
                properties={
                    "github_url": org.get("url"),
                    "public_repos": org.get("public_repos"),
                    "followers": org.get("followers"),
                },
                confidence=0.9,
                sources=["github"]
            ))
        
        # Technologies from GitHub repos
        for lang in github.get("languages", []):
            entities.append(Entity(
                id=f"tech_{lang.lower()}",
                type=EntityType.TECHNOLOGY,
                name=lang,
                properties={"source": "github"},
                confidence=0.85,
                sources=["github"]
            ))
        
        # DNS-based entities
        dns_info = enrichment.get("dns", {})
        if dns_info.get("email_provider"):
            entities.append(Entity(
                id=f"integration_{dns_info['email_provider'].lower().replace(' ', '_')}",
                type=EntityType.INTEGRATION,
                name=dns_info["email_provider"],
                properties={"type": "email_provider"},
                confidence=0.95,
                sources=["dns"]
            ))
        
        return entities
    
    def _entities_from_tech_stack(self, tech_stack) -> list[Entity]:
        """Create entities from detected tech stack."""
        entities = []
        
        for tech in tech_stack.technologies:
            entities.append(Entity(
                id=f"tech_{tech.lower()}",
                type=EntityType.TECHNOLOGY,
                name=tech.title(),
                properties={"detected_from": "html"},
                confidence=0.8,
                sources=["tech_detection"]
            ))
        
        for framework in tech_stack.frameworks:
            entities.append(Entity(
                id=f"tech_{framework.lower()}",
                type=EntityType.TECHNOLOGY,
                name=framework.title(),
                properties={"type": "framework"},
                confidence=0.85,
                sources=["tech_detection"]
            ))
        
        if tech_stack.hosting:
            entities.append(Entity(
                id=f"integration_{tech_stack.hosting.lower()}",
                type=EntityType.INTEGRATION,
                name=tech_stack.hosting.title(),
                properties={"type": "hosting"},
                confidence=0.8,
                sources=["tech_detection"]
            ))
        
        return entities
    
    def _generate_insights(
        self,
        graph: KnowledgeGraph,
        enrichment: dict,
        main_crawl: dict,
        competitor_crawls: list[dict]
    ) -> list[Insight]:
        """Generate insights from the assembled data."""
        insights = []
        insight_id = 0
        
        # =========================================================
        # SECURITY INSIGHTS
        # =========================================================
        dns_info = enrichment.get("dns", {})
        
        if not dns_info.get("has_spf"):
            insight_id += 1
            insights.append(Insight(
                id=f"insight_{insight_id}",
                type=InsightType.RISK,
                severity=InsightSeverity.MEDIUM,
                title="Missing SPF Record",
                description="No SPF record detected. Email spoofing protection may be inadequate.",
                recommendation="Configure SPF records to prevent email spoofing attacks.",
                confidence=0.9
            ))
        
        if not dns_info.get("has_dmarc"):
            insight_id += 1
            insights.append(Insight(
                id=f"insight_{insight_id}",
                type=InsightType.RISK,
                severity=InsightSeverity.MEDIUM,
                title="Missing DMARC Record",
                description="No DMARC policy detected. Email authentication is incomplete.",
                recommendation="Implement DMARC to improve email deliverability and security.",
                confidence=0.9
            ))
        
        # =========================================================
        # TECHNOLOGY INSIGHTS
        # =========================================================
        tech_entities = [e for e in graph.entities if e.type == EntityType.TECHNOLOGY]
        
        if len(tech_entities) > 10:
            insight_id += 1
            insights.append(Insight(
                id=f"insight_{insight_id}",
                type=InsightType.TREND,
                severity=InsightSeverity.LOW,
                title="Complex Technology Stack",
                description=f"Detected {len(tech_entities)} technologies. Complex stacks may indicate technical maturity or tech debt.",
                confidence=0.7
            ))
        
        # =========================================================
        # GITHUB INSIGHTS
        # =========================================================
        github = enrichment.get("github", {})
        
        if github.get("organization"):
            org = github["organization"]
            
            if org.get("public_repos", 0) > 20:
                insight_id += 1
                insights.append(Insight(
                    id=f"insight_{insight_id}",
                    type=InsightType.OPPORTUNITY,
                    severity=InsightSeverity.LOW,
                    title="Active Open Source Presence",
                    description=f"Company has {org.get('public_repos')} public repositories, indicating developer-focused culture.",
                    confidence=0.8
                ))
            
            if github.get("total_stars", 0) > 1000:
                insight_id += 1
                insights.append(Insight(
                    id=f"insight_{insight_id}",
                    type=InsightType.COMPETITIVE,
                    severity=InsightSeverity.MEDIUM,
                    title="Strong Developer Community",
                    description=f"GitHub projects have {github.get('total_stars')} total stars, showing strong community engagement.",
                    confidence=0.85
                ))
        
        # =========================================================
        # WEBSITE STRUCTURE INSIGHTS  
        # =========================================================
        sitemap = main_crawl.get("sitemap")
        
        if sitemap:
            if sitemap.has_blog and sitemap.url_count > 50:
                insight_id += 1
                insights.append(Insight(
                    id=f"insight_{insight_id}",
                    type=InsightType.COMPETITIVE,
                    severity=InsightSeverity.LOW,
                    title="Active Content Marketing",
                    description="Company has a blog and substantial content library, indicating SEO investment.",
                    confidence=0.75
                ))
            
            if sitemap.has_docs:
                insight_id += 1
                insights.append(Insight(
                    id=f"insight_{insight_id}",
                    type=InsightType.TREND,
                    severity=InsightSeverity.LOW,
                    title="Developer Documentation Available",
                    description="Company maintains public documentation, suggesting API/developer product.",
                    confidence=0.8
                ))
        
        # =========================================================
        # ENTITY-BASED INSIGHTS
        # =========================================================
        integration_count = len([e for e in graph.entities if e.type == EntityType.INTEGRATION])
        
        if integration_count < 5:
            insight_id += 1
            insights.append(Insight(
                id=f"insight_{insight_id}",
                type=InsightType.GAP,
                severity=InsightSeverity.MEDIUM,
                title="Limited Integration Ecosystem",
                description=f"Only {integration_count} integrations detected. Expanding integrations could improve market fit.",
                recommendation="Consider prioritizing integrations with market-leading tools in your space.",
                confidence=0.7
            ))
        elif integration_count > 20:
            insight_id += 1
            insights.append(Insight(
                id=f"insight_{insight_id}",
                type=InsightType.COMPETITIVE,
                severity=InsightSeverity.MEDIUM,
                title="Strong Integration Ecosystem",
                description=f"{integration_count} integrations detected, indicating mature platform strategy.",
                confidence=0.8
            ))
        
        return insights
