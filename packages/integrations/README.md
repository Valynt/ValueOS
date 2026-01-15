# @valueos/integrations

Enterprise integration adapters for ValueOS.

## Structure

```
integrations/
├── base/           # Interface, abstract class, shared utilities
├── hubspot/        # HubSpot CRM adapter
├── salesforce/     # Salesforce adapter
├── servicenow/     # ServiceNow adapter
├── sharepoint/     # SharePoint adapter
└── slack/          # Slack adapter
```

## Import Rules

| Consumer | Can Import? |
|----------|-------------|
| `packages/backend` | ✅ Yes |
| `packages/agents` | ✅ Yes |
| `packages/memory` | ✅ Yes (for ingestion) |
| `apps/ValyntApp` | ❌ No |

**Frontend never talks to external systems directly.**

## Design Principles

1. **Adapters return normalized domain objects** - not raw vendor payloads
2. **No UI, no Express, no database writes** - pure integration logic
3. **Rate limiting is per-provider** - each adapter respects vendor limits
4. **Auth refresh is handled internally** - consumers don't manage tokens
