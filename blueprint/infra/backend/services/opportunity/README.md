# Opportunity Service

This microservice implements the **Opportunity Agent**. It exposes an API for ingesting discovery data and outputs an initial value model.

## Structure

- `main.py` – FastAPI entrypoint exposing `/api/opportunity/process`.
- `requirements.txt` – Python dependencies (see `opportunity_agent.yaml` for alignment).
- `Dockerfile` – Container definition for deployment.

## Running Locally

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8080
```

## Deployment

The service is containerized via Docker; see the root `docker-compose.yml` for orchestration with other agents. Kubernetes manifests are located under `../k8s` (not included here).