# Backend Dependencies for Frontend Features

This document tracks backend API endpoints required by frontend features.

---

## Tenant Context (Sprint 0.5)

### Required Endpoint: User Tenants List

**Status**: ⚠️ Pending - Using Supabase direct query as fallback

**Endpoint Spec**:

```
GET /api/users/:userId/tenants
Authorization: Bearer <jwt>

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "name": "Tenant Name",
      "slug": "tenant-slug",
      "color": "#18C3A5",
      "role": "admin|member|viewer",
      "status": "active|inactive|pending",
      "createdAt": "ISO8601"
    }
  ]
}

Response 401: Unauthorized
Response 500: Server Error
```

**Current Fallback**:
The frontend queries `user_tenants` table directly via Supabase client with RLS protection. This works but:

1. Requires `tenants` table to exist with proper schema
2. Relies on RLS policies for security
3. May need migration if schema differs

**Feature Flag**:

- `VITE_TENANTS_API_ENABLED=true|false` (default: true)
- When false, tenant features are hidden

**Files**:

- `src/api/tenant.ts` - API client
- `src/contexts/TenantContext.tsx` - React context
- `src/components/Layout/TenantSwitcher.tsx` - UI component
- `src/components/Layout/TenantBadge.tsx` - Badge component

---

## Future Dependencies

### Agent WebSocket (Sprint 1)

- WebSocket endpoint for agent state streaming
- Channel pattern: `agent:${sessionId}`

### Persona API (Sprint 2)

- User persona preferences storage
- Behavioral scoring endpoint (optional)
