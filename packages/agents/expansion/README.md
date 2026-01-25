# Expansion Agent

The Expansion Agent identifies and analyzes strategies for business growth and expansion within ValueOS.

## Capabilities

- **Geographic Expansion:** Analyzes opportunities to enter new markets.
- **Product Diversification:** Suggests new product lines or extensions.
- **Customer Segmentation:** Identifies new customer segments to target.
- **Distribution Channels:** Evaluates new ways to reach customers.

## Configuration

The agent runs as an Express service and utilizes the shared agent runtime configuration.

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | The port the agent server listens on | `3000` (or configured via environment) |

## API Usage

### `POST /query`

Analyzes an expansion query and returns strategic opportunities.

**Request Body:**

```json
{
  "query": "expand into european market",
  "context": {
    "userId": "user-123",
    "organizationId": "org-456"
  }
}
```

**Response:**

```json
{
  "expansions": [
    {
      "title": "Geographic Market Expansion",
      "description": "...",
      "confidence": 0.85,
      "category": "Market Expansion",
      "priority": "High",
      "timeframe": "12-18 months"
    }
  ],
  "analysis": "...",
  "timestamp": "2023-10-27T10:00:00Z"
}
```

## Testing

Run unit tests:

```bash
npx vitest run packages/agents/expansion
```
