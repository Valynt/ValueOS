"""
Pydantic models for the Ontology Discovery Agent.
Defines entities, relationships, insights, and API contracts.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field, HttpUrl


# =============================================================================
# Entity Types
# =============================================================================

class EntityType(str, Enum):
    ORGANIZATION = "organization"
    PRODUCT = "product"
    FEATURE = "feature"
    PERSON = "person"
    TECHNOLOGY = "technology"
    INTEGRATION = "integration"
    CUSTOMER = "customer"
    COMPETITOR = "competitor"


class Entity(BaseModel):
    """A discovered entity in the ontology."""
    id: str
    type: EntityType
    name: str
    description: Optional[str] = None
    properties: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)
    sources: list[str] = Field(default_factory=list)
    first_seen: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# Relationship Types
# =============================================================================

class RelationType(str, Enum):
    OWNS = "owns"
    HAS_FEATURE = "has_feature"
    USES_TECHNOLOGY = "uses_technology"
    INTEGRATES_WITH = "integrates_with"
    COMPETES_WITH = "competes_with"
    EMPLOYS = "employs"
    SERVES_CUSTOMER = "serves_customer"
    FOUNDED_BY = "founded_by"
    PART_OF = "part_of"


class Relationship(BaseModel):
    """A relationship between two entities."""
    id: str
    source_id: str
    target_id: str
    type: RelationType
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)
    evidence: Optional[str] = None
    inferred: bool = False


# =============================================================================
# Insights
# =============================================================================

class InsightSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class InsightType(str, Enum):
    GAP = "gap"
    OPPORTUNITY = "opportunity"
    RISK = "risk"
    COMPETITIVE = "competitive"
    TREND = "trend"


class Insight(BaseModel):
    """A generated insight from the analysis."""
    id: str
    type: InsightType
    severity: InsightSeverity
    title: str
    description: str
    recommendation: Optional[str] = None
    evidence: list[str] = Field(default_factory=list)
    related_entities: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)


# =============================================================================
# Knowledge Graph
# =============================================================================

class KnowledgeGraph(BaseModel):
    """The complete knowledge graph output."""
    entities: list[Entity] = Field(default_factory=list)
    relationships: list[Relationship] = Field(default_factory=list)
    
    @property
    def entity_count(self) -> int:
        return len(self.entities)
    
    @property
    def relationship_count(self) -> int:
        return len(self.relationships)


# =============================================================================
# API Request/Response Models
# =============================================================================

class AnalyzeRequest(BaseModel):
    """Request to start an ontology analysis."""
    url: HttpUrl
    competitor_urls: list[HttpUrl] = Field(default_factory=list, max_length=5)
    industry_hints: list[str] = Field(default_factory=list, max_length=10)


class AnalyzeResponse(BaseModel):
    """Response with job ID to track progress."""
    job_id: str
    status: str = "queued"
    message: str = "Analysis job created"


class JobStatus(str, Enum):
    QUEUED = "queued"
    CRAWLING = "crawling"
    EXTRACTING = "extracting"
    BUILDING_GRAPH = "building_graph"
    GENERATING_INSIGHTS = "generating_insights"
    COMPLETED = "completed"
    FAILED = "failed"


class ProgressUpdate(BaseModel):
    """Real-time progress update via WebSocket."""
    job_id: str
    status: JobStatus
    progress: float = Field(ge=0.0, le=1.0)
    message: str
    entities_found: int = 0
    relationships_found: int = 0
    current_source: Optional[str] = None


class AnalysisResult(BaseModel):
    """Complete analysis result."""
    job_id: str
    url: str
    completed_at: datetime
    processing_time_seconds: float
    graph: KnowledgeGraph
    insights: list[Insight]
    sources_crawled: int
    warnings: list[str] = Field(default_factory=list)


# =============================================================================
# Crawled Data Models
# =============================================================================

class CrawledPage(BaseModel):
    """Data from a single crawled page."""
    url: str
    title: Optional[str] = None
    content: str = ""
    json_ld: list[dict] = Field(default_factory=list)
    meta_tags: dict[str, str] = Field(default_factory=dict)
    links: list[str] = Field(default_factory=list)
    crawled_at: datetime = Field(default_factory=datetime.utcnow)


class TechStackInfo(BaseModel):
    """Detected technology stack."""
    technologies: list[str] = Field(default_factory=list)
    frameworks: list[str] = Field(default_factory=list)
    analytics: list[str] = Field(default_factory=list)
    hosting: Optional[str] = None


class SitemapInfo(BaseModel):
    """Parsed sitemap information."""
    urls: list[str] = Field(default_factory=list)
    url_count: int = 0
    has_blog: bool = False
    has_docs: bool = False
    has_pricing: bool = False
