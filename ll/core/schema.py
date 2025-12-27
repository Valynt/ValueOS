from enum import Enum
from typing import List, Optional, Union
from pydantic import BaseModel, Field

class SourceTier(str, Enum):
    TIER_1 = "Tier 1: Gold Standard"
    TIER_2 = "Tier 2: Consultant Library"
    TIER_3 = "Tier 3: Market Reality"

class KnowledgeStatus(str, Enum):
    DRAFT = "DRAFT"
    REVIEWED = "REVIEWED"
    VALIDATED = "VALIDATED"
    DEPRECATED = "DEPRECATED"

class ImpactDistribution(BaseModel):
    p10: float = Field(..., description="Conservative estimate (10th percentile)")
    p50: float = Field(..., description="Median/Expected impact (50th percentile)")
    p90: float = Field(..., description="Optimistic estimate (90th percentile)")
    unit: str = Field(..., description="Unit of measure (e.g., %, USD, hours)")

class Evidence(BaseModel):
    source_name: str
    tier: SourceTier
    quote: str
    url: Optional[str] = None
    discount_factor_applied: float = 1.0

class CascadingEffect(BaseModel):
    downstream_kpi: str
    via_formula: Optional[str] = None
    expected_uplift: ImpactDistribution

class CausalRelationship(BaseModel):
    id: str
    driver_action: str = Field(..., description="The action taken (e.g., Cloud Migration)")
    target_kpi: str = Field(..., description="The KPI affected (e.g., TCO)")
    direction: str = Field(..., description="INCREASE or DECREASE")
    mechanism: str = Field(..., description="The logical 'How' behind the causal link")
    impact_distribution: ImpactDistribution
    elasticity_curve: Optional[str] = Field("linear", description="Shape of the impact curve (linear, logarithmic, etc)")
    time_to_realize: Optional[str] = Field(None, description="Expected time to see results (e.g., 6_months)")
    confidence_score: float = Field(..., ge=0, le=1, description="Confidence score from 0.0 to 1.0")
    contextual_validity: List[str] = Field(..., description="Preconditions or industry context")
    side_effects: List[str] = Field(default_factory=list, description="Unintended consequences")
    cascading_effects: List[CascadingEffect] = Field(default_factory=list)
    evidence: List[Evidence]
    status: KnowledgeStatus = KnowledgeStatus.DRAFT

class CausalTruthDataset(BaseModel):
    version: str = "1.5"  # Bumped version to reflect schema expansion
    metadata: dict = {}
    relationships: List[CausalRelationship]
