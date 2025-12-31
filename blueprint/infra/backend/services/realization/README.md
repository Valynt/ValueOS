# Realization Service

This microservice implements the **Realization Agent**. It ingests telemetry data, compares actual performance to committed targets, and generates realization reports.

### Structure
- `main.py` – FastAPI entrypoint exposing `/api/realization/process`.
- `requirements.txt` – Python dependencies for analytics.
- `Dockerfile` – Container definition.

### Running Locally
```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8082
```