from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict

app = FastAPI(title="Expansion Agent Service")


class ExpansionRequest(BaseModel):
    realizationData: Dict[str, Any] = Field(...)
    benchmarks: Dict[str, Any] = Field(...)


class ExpansionResponse(BaseModel):
    expansionModel: Dict[str, Any]
    upsellCase: Dict[str, Any]


@app.post("/api/expansion/process", response_model=ExpansionResponse)
async def process_expansion(data: ExpansionRequest):
    try:
        # placeholder: in real implementation, compare realization vs benchmark to propose improvements
        expansion_model = {
            'id': 'auto-generated',
            'proposedImprovements': [
                {"kpiId": "kpi-time-saved", "incrementalValue": 5, "unit": "percent", "confidence": 0.7},
                {"kpiId": "kpi-revenue", "incrementalValue": 20000, "unit": "USD", "confidence": 0.6}
            ],
            'executiveSummary': 'Opportunity to automate more workflows and upsell advanced analytics.'
        }
        upsell_case = {
            'roi': 2.5,
            'payback_months': 10,
            'investment': 40000,
            'benefits': 100000
        }
        return ExpansionResponse(expansionModel=expansion_model, upsellCase=upsell_case)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health/live")
async def health_live():
    return {"status": "alive"}


@app.get("/health/ready")
async def health_ready():
    return {"status": "ready"}