# Ontology Discovery Agent

An intelligent agent system that transforms a website URL into a complete knowledge graph with actionable competitive insights.

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Architecture

- **Backend**: Python FastAPI with async agents
- **Frontend**: Next.js 14 + ECharts
- **Database**: PostgreSQL + JSONB
- **LLM**: OpenAI gpt-4o-mini

## API Endpoints

- `POST /api/analyze` - Start ontology discovery
- `WS /api/ws/{job_id}` - Real-time progress updates
- `GET /api/results/{job_id}` - Get analysis results
