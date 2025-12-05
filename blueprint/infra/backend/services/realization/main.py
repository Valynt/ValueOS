from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List

app = FastAPI(title="Realization Agent Service")


class Target(BaseModel):
    kpiId: str
    targetValue: float
    unit: str


class Telemetry(BaseModel):
    kpiId: str
    timestamp: str
    value: float


class RealizationRequest(BaseModel):
    valueCommit: Dict[str, Any]
    telemetryData: List[Telemetry]


class RealizationReport(BaseModel):
    realizationReport: Dict[str, Any]
    renewalAlert: Dict[str, Any]


@app.post("/api/realization/process", response_model=RealizationReport)
async def process_realization(data: RealizationRequest):
    try:
        # Build report by comparing averages to targets
        targets = {t['kpiId']: t for t in data.valueCommit.get('kpiTargets', [])}
        aggregates = {}
        for t in data.telemetryData:
            aggregates.setdefault(t.kpiId, []).append(t.value)
        results = []
        renewal_flag = False
        for kpi_id, values in aggregates.items():
            actual = sum(values) / len(values)
            target = targets.get(kpi_id, {}).get('targetValue')
            unit = targets.get(kpi_id, {}).get('unit')
            variance = None
            if target is not None:
                variance = actual - target
                if variance < 0:
                    renewal_flag = True
            results.append({
                'kpiId': kpi_id,
                'actualValue': actual,
                'targetValue': target,
                'unit': unit,
                'variance': variance
            })
        report = {
            'id': 'auto-generated',
            'valueCommitId': data.valueCommit.get('id'),
            'generatedAt': '2025-11-17T00:00:00Z',
            'results': results
        }
        alert = {'status': 'ok'}
        if renewal_flag:
            alert = {'status': 'risk', 'message': 'Value delivery below target for one or more KPIs'}
        return RealizationReport(realizationReport=report, renewalAlert=alert)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health/live")
async def health_live():
    return {"status": "alive"}


@app.get("/health/ready")
async def health_ready():
    return {"status": "ready"}