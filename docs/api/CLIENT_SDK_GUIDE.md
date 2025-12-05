# Client SDK Guide

## Generating Typed Clients
- Run `npm run sdk:generate` to regenerate `src/api/client/generated-types.ts` from `openapi.yaml`.
- Commit regenerated types alongside any API schema changes.
- Use the `API-Version` header in responses to confirm the version your SDK is targeting.

## Usage Patterns
### Authentication
```ts
import type { paths } from '@/api/client/generated-types';

type CanvasResponse = paths['/canvas']['post']['responses']['201']['content']['application/json'];

async function createCanvas(token: string, payload: unknown) {
  const response = await fetch('/api/v1/canvas', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-API-Version': 'v1',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as CanvasResponse;
}
```

### Pagination
```ts
import type { components, paths } from '@/api/client/generated-types';

type CanvasList = components['schemas']['CanvasList'];

type ListResponse = paths['/canvas']['get']['responses']['200']['content']['application/json'];

async function listCanvases(token: string, page = 1, pageSize = 20) {
  const search = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const response = await fetch(`/api/v1/canvas?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-API-Version': 'v1',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const body = (await response.json()) as ListResponse;
  return body as CanvasList;
}
```

### Error Handling
```ts
import type { components } from '@/api/client/generated-types';

type ErrorResponse = components['schemas']['ErrorResponse'];

async function handleErrors(response: Response) {
  if (response.ok) return;
  const payload = (await response.json()) as ErrorResponse;
  throw new Error(payload.message ?? 'Unknown error');
}
```

## Publishing SDK Documentation
- Include SDK usage in release notes using `docs/api/API_CHANGELOG_TEMPLATE.md`.
- Link to these examples from developer portals and README files.
- Keep examples aligned with current API versions and update when `API-Version` changes.
