from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List
import jsonschema

app = FastAPI(title="Integrity Agent Service")


class IntegrityRequest(BaseModel):
    artifact: Dict[str, Any]
    manifestoRules: List[str]


class IntegrityResponse(BaseModel):
    validatedArtifact: Dict[str, Any]
    corrections: List[str]


# Sample rule check functions
def check_no_hype(artifact: Dict[str, Any]) -> List[str]:
    issues = []
    # Example rule: description should not contain banned words like 'guaranteed'
    description = json.dumps(artifact).lower()
    if 'guaranteed' in description:
        issues.append("Remove hype language: 'guaranteed'")
    return issues

rule_functions = {
    'Quantify value credibly and conservatively': check_no_hype
}


@app.post("/api/integrity/process", response_model=IntegrityResponse)
async def process_integrity(data: IntegrityRequest):
    try:
        issues: List[str] = []
        for rule in data.manifestoRules:
            func = rule_functions.get(rule)
            if func:
                issues.extend(func(data.artifact))
        validated = data.artifact.copy()
        # Placeholder: apply corrections
        return IntegrityResponse(validatedArtifact=validated, corrections=issues)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health/live")
async def health_live():
    return {"status": "alive"}


@app.get("/health/ready")
async def health_ready():
    return {"status": "ready"}