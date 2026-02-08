# Target Agent

**Last Updated**: 2026-02-08

**Consolidated from 1 source documents**

---

## Target Service

*Source: `engineering/blueprint/infra/backend/services/target/README.md`*

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

---