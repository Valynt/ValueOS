# Realization Agent

**Last Updated**: 2026-02-08

**Consolidated from 1 source documents**

---

## Realization Service

*Source: `engineering/blueprint/infra/backend/services/realization/README.md`*

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

---