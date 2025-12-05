# Target Service

This microservice implements the **Target Agent**. It builds conservative business cases and commits to value targets.

### Structure
- `main.py` – FastAPI entrypoint exposing `/api/target/process`.
- `requirements.txt` – Python dependencies for ROI calculations.
- `Dockerfile` – Container definition.

### Running Locally
```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8081
```