from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any

app = FastAPI(title="Opportunity Agent Service")


class DiscoveryData(BaseModel):
    customerProfile: Dict[str, Any] = Field(..., description="Firmographic and persona data")
    discoveryData: List[str] = Field(..., description="List of raw discovery inputs (transcripts, notes, etc.)")


class OpportunityResult(BaseModel):
    opportunitySummary: str
    personaFit: Dict[str, Any]
    initialValueModel: Dict[str, Any]


@app.post("/api/opportunity/process", response_model=OpportunityResult)
async def process_opportunity(data: DiscoveryData):
    """Endpoint to process discovery data and return an initial value model."""
    # In a real implementation, this would involve NL processing and mapping to the value tree.
    # For demo purposes, we return placeholder values.
    try:
        summary = "Identified pain points around efficiency and cost savings."
        persona_fit = {"persona": "Operations Manager", "fitScore": 0.8}
        value_model = {
            "outcomes": ["Reduce manual work by 20%", "Increase revenue by 5%"],
            "kpis": ["Time saved", "Incremental revenue"],
            "financialImpact": {"revenue": 50000, "cost": -20000, "risk": 0}
        }
        return OpportunityResult(
            opportunitySummary=summary,
            personaFit=persona_fit,
            initialValueModel=value_model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health/live")
async def health_live():
    return {"status": "alive"}


@app.get("/health/ready")
async def health_ready():
    return {"status": "ready"}