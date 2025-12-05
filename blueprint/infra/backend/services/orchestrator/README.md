# Orchestrator Service

This microservice implements the **Orchestrator Agent**. It coordinates workflows across Opportunity, Target, Realization, Expansion, and Integrity agents.

### Structure
- `main.py` – FastAPI entrypoint exposing `/api/orchestrator/process`.
- `requirements.txt` – Python dependencies.
- `Dockerfile` – Container definition.

### Running Locally

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8085
```