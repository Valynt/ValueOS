# Research Agent

The Research Agent is responsible for handling research tasks, data collection, and analytical studies within ValueOS.

## Capabilities

- **Market Research:** Generates comprehensive market analysis frameworks.
- **Data Collection:** Designs survey and data collection methodologies.
- **Trend Analysis:** Identifies trends and creates forecasting models.
- **Qualitative Research:** Provides frameworks for qualitative interviews and thematic analysis.

## Configuration

The agent runs as an Express service and utilizes the shared agent runtime configuration.

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | The port the agent server listens on | `3000` (or configured via environment) |

## API Usage

### `POST /query`

Analyzes a research query and returns structured methodologies.

**Request Body:**

```json
{
  "query": "market analysis for new tech product",
  "context": {
    "userId": "user-123",
    "organizationId": "org-456"
  }
}
```

**Response:**

```json
{
  "researches": [
    {
      "title": "Market Research Methodology",
      "description": "...",
      "confidence": 0.88,
      "category": "Market",
      "research_type": "Analysis Framework",
      "priority": "High"
    }
  ],
  "analysis": "...",
  "timestamp": "2023-10-27T10:00:00Z"
}
```

## Testing

Run unit tests:

```bash
npx vitest run packages/agents/research
```
