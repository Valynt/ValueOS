# Integrity Service

This microservice implements the **Integrity Agent**. It validates outputs from other agents against manifesto rules and resolves conflicts.

### Structure
- `main.py` – FastAPI entrypoint exposing `/api/integrity/process`.
- `requirements.txt` – Python dependencies for validation.
- `Dockerfile` – Container definition.

### Running Locally

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8084
```