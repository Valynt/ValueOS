"""
Entity Extractor Agent.
Uses LLM-powered extraction to identify entities and relationships from crawled content.
"""

import asyncio
import hashlib
import re
from typing import Optional
from pydantic import BaseModel

from core.schemas import (
    Entity, 
    EntityType, 
    Relationship, 
    RelationType,
    CrawledPage
)
from utils.llm import LLMClient, ENTITY_EXTRACTION_PROMPT


class ExtractedEntities(BaseModel):
    """LLM extraction response model."""
    entities: list[dict] = []
    relationships: list[dict] = []


class ExtractorAgent:
    """
    Extracts entities and relationships from crawled content.
    Uses a hybrid approach: pattern matching + LLM extraction.
    """
    
    # Pattern-based extractors for common entity types
    PATTERNS = {
        "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        "phone": r"\b(?:\+1)?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b",
        "pricing": r"\$[\d,]+(?:\.\d{2})?(?:/\w+)?",
        "percentage": r"\b\d+(?:\.\d+)?%\b",
    }
    
    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm = llm_client or LLMClient()
    
    async def extract_from_pages(
        self,
        pages: list[CrawledPage],
        use_llm: bool = True
    ) -> tuple[list[Entity], list[Relationship]]:
        """
        Extract entities and relationships from crawled pages.
        
        Args:
            pages: List of crawled pages
            use_llm: Whether to use LLM for extraction
            
        Returns:
            Tuple of (entities, relationships)
        """
        all_entities = []
        all_relationships = []
        
        # Extract from JSON-LD first (structured data is most reliable)
        for page in pages:
            if page.json_ld:
                entities, rels = self._extract_from_json_ld(page.json_ld, page.url)
                all_entities.extend(entities)
                all_relationships.extend(rels)
        
        # Pattern-based extraction
        for page in pages:
            entities = self._extract_patterns(page)
            all_entities.extend(entities)
        
        # LLM-powered extraction (parallel for speed)
        if use_llm:
            llm_tasks = [
                self._llm_extract_page(page)
                for page in pages[:5]  # Limit to avoid costs
            ]
            
            llm_results = await asyncio.gather(*llm_tasks, return_exceptions=True)
            
            for result in llm_results:
                if isinstance(result, tuple):
                    entities, rels = result
                    all_entities.extend(entities)
                    all_relationships.extend(rels)
        
        # Deduplicate entities
        all_entities = self._deduplicate_entities(all_entities)
        
        return all_entities, all_relationships
    
    def _extract_from_json_ld(
        self, 
        json_ld: list[dict], 
        source_url: str
    ) -> tuple[list[Entity], list[Relationship]]:
        """Extract entities from JSON-LD structured data."""
        entities = []
        relationships = []
        
        for item in json_ld:
            item_type = item.get("@type", "")
            
            # Organization
            if item_type in ["Organization", "Corporation", "LocalBusiness"]:
                entity = Entity(
                    id=self._generate_id(item.get("name", "unknown"), "organization"),
                    type=EntityType.ORGANIZATION,
                    name=item.get("name", "Unknown"),
                    description=item.get("description"),
                    properties={
                        "url": item.get("url"),
                        "logo": item.get("logo"),
                        "founding_date": item.get("foundingDate"),
                        "address": item.get("address"),
                    },
                    confidence=0.95,
                    sources=[source_url]
                )
                entities.append(entity)
            
            # Product
            elif item_type in ["Product", "SoftwareApplication"]:
                entity = Entity(
                    id=self._generate_id(item.get("name", "unknown"), "product"),
                    type=EntityType.PRODUCT,
                    name=item.get("name", "Unknown Product"),
                    description=item.get("description"),
                    properties={
                        "category": item.get("applicationCategory"),
                        "price": item.get("offers", {}).get("price"),
                        "rating": item.get("aggregateRating", {}).get("ratingValue"),
                    },
                    confidence=0.95,
                    sources=[source_url]
                )
                entities.append(entity)
            
            # Person
            elif item_type == "Person":
                entity = Entity(
                    id=self._generate_id(item.get("name", "unknown"), "person"),
                    type=EntityType.PERSON,
                    name=item.get("name", "Unknown"),
                    properties={
                        "job_title": item.get("jobTitle"),
                        "url": item.get("url"),
                    },
                    confidence=0.95,
                    sources=[source_url]
                )
                entities.append(entity)
        
        return entities, relationships
    
    def _extract_patterns(self, page: CrawledPage) -> list[Entity]:
        """Extract entities using regex patterns."""
        entities = []
        
        # Extract pricing mentions
        prices = re.findall(self.PATTERNS["pricing"], page.content)
        for price in set(prices[:5]):  # Limit
            entities.append(Entity(
                id=self._generate_id(price, "pricing"),
                type=EntityType.FEATURE,
                name=f"Pricing: {price}",
                properties={"raw_price": price},
                confidence=0.8,
                sources=[page.url]
            ))
        
        return entities
    
    async def _llm_extract_page(
        self, 
        page: CrawledPage
    ) -> tuple[list[Entity], list[Relationship]]:
        """Use LLM to extract entities from page content."""
        entities = []
        relationships = []
        
        try:
            prompt = ENTITY_EXTRACTION_PROMPT.format(
                url=page.url,
                content=page.content[:5000]  # Limit content for API
            )
            
            result = await self.llm.extract_json(
                prompt,
                system_prompt="You are an expert at extracting business entities from web content. Return valid JSON."
            )
            
            # Process extracted entities
            for e in result.get("entities", []):
                entity_type = self._map_entity_type(e.get("type", ""))
                if entity_type:
                    entities.append(Entity(
                        id=self._generate_id(e.get("name", ""), entity_type.value),
                        type=entity_type,
                        name=e.get("name", "Unknown"),
                        description=e.get("description"),
                        confidence=e.get("confidence", 0.7),
                        sources=[page.url]
                    ))
            
            # Process relationships
            for r in result.get("relationships", []):
                rel_type = self._map_relationship_type(r.get("type", ""))
                if rel_type:
                    relationships.append(Relationship(
                        id=self._generate_id(f"{r.get('source')}-{r.get('target')}", rel_type.value),
                        source_id=self._generate_id(r.get("source", ""), "unknown"),
                        target_id=self._generate_id(r.get("target", ""), "unknown"),
                        type=rel_type,
                        evidence=r.get("evidence"),
                        confidence=0.7
                    ))
                    
        except Exception as e:
            print(f"LLM extraction failed for {page.url}: {e}")
        
        return entities, relationships
    
    def _map_entity_type(self, type_str: str) -> Optional[EntityType]:
        """Map string type to EntityType enum."""
        mapping = {
            "organization": EntityType.ORGANIZATION,
            "company": EntityType.ORGANIZATION,
            "product": EntityType.PRODUCT,
            "service": EntityType.PRODUCT,
            "feature": EntityType.FEATURE,
            "capability": EntityType.FEATURE,
            "technology": EntityType.TECHNOLOGY,
            "tech": EntityType.TECHNOLOGY,
            "person": EntityType.PERSON,
            "integration": EntityType.INTEGRATION,
            "customer": EntityType.CUSTOMER,
            "competitor": EntityType.COMPETITOR,
        }
        return mapping.get(type_str.lower())
    
    def _map_relationship_type(self, type_str: str) -> Optional[RelationType]:
        """Map string type to RelationType enum."""
        mapping = {
            "owns": RelationType.OWNS,
            "has_feature": RelationType.HAS_FEATURE,
            "has": RelationType.HAS_FEATURE,
            "uses_technology": RelationType.USES_TECHNOLOGY,
            "uses": RelationType.USES_TECHNOLOGY,
            "integrates_with": RelationType.INTEGRATES_WITH,
            "integrates": RelationType.INTEGRATES_WITH,
            "competes_with": RelationType.COMPETES_WITH,
            "competes": RelationType.COMPETES_WITH,
            "employs": RelationType.EMPLOYS,
        }
        return mapping.get(type_str.lower())
    
    def _generate_id(self, name: str, type_prefix: str) -> str:
        """Generate a deterministic ID for an entity."""
        normalized = name.lower().strip()
        hash_input = f"{type_prefix}:{normalized}"
        return hashlib.md5(hash_input.encode()).hexdigest()[:12]
    
    def _deduplicate_entities(self, entities: list[Entity]) -> list[Entity]:
        """Remove duplicate entities, keeping highest confidence."""
        seen = {}
        
        for entity in entities:
            if entity.id in seen:
                # Keep higher confidence
                if entity.confidence > seen[entity.id].confidence:
                    seen[entity.id] = entity
            else:
                seen[entity.id] = entity
        
        return list(seen.values())
