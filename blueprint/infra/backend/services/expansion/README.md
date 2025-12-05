# Expansion Service

This microservice implements the **Expansion Agent**. It identifies incremental value opportunities and produces upsell business cases based on benchmarks.

### Structure
- `main.py` – FastAPI entrypoint exposing `/api/expansion/process`.
- `requirements.txt` – Python dependencies for analytics and graph queries.
- `Dockerfile` – Container definition.

### Running Locally
```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8083
```