# RBAC Role Taxonomy and Permission Matrix

This document describes how ValueOS resolves authorization with both system roles and tenant-scoped custom roles.

## Role taxonomy

ValueOS now supports two role classes:

1. **System roles** (`owner`, `admin`, `member`, `viewer`) stored in `user_roles`.
2. **Tenant custom roles** stored in `roles`, mapped to users through `memberships` + `membership_roles` and permissioned via `role_permissions` + `permissions`.

Custom roles are persisted using a tenant-qualified name format:

- `custom:<tenantId>:<roleName>`

This keeps role definitions tenant-scoped without requiring schema changes to the `roles` table.

## Matrix behavior

The effective permission set for a user is calculated from three sources:

1. Permission grants inherited from system roles (`user_roles` + static role map).
2. Permission grants inherited from tenant custom roles (`membership_roles` -> `role_permissions` -> `permissions.key`).
3. Explicit permission grants in `user_permissions`.

Permission checks use wildcard-aware matching and are evaluated with OR semantics.

## Admin API for role matrix management

`/api/admin` now includes endpoints for tenant role matrix administration:

- `POST /roles` create custom role
- `PATCH /roles/:roleId` update custom role metadata
- `DELETE /roles/:roleId` delete custom role
- `GET /roles/matrix` list custom roles and attached permissions
- `POST /roles/:roleId/permissions` assign permissions to role
- `DELETE /roles/:roleId/permissions` remove permissions from role

All matrix mutations require `roles.assign` and emit immutable audit log entries.

## Audit hooks

Each role/permission matrix mutation writes an audit log event:

- `rbac.role.create`
- `rbac.role.update`
- `rbac.role.delete`
- `rbac.role_permissions.assign`
- `rbac.role_permissions.remove`

Events include actor metadata, tenant id, role id, and the requested permission keys.
