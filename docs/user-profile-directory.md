# Canonical User Profile Directory

`public.user_profile_directory` is the canonical contract for tenant-admin user listings (`/api/admin/users`).

## Canonical fields and source-of-truth

| Field | Owner / source-of-truth | Notes |
| --- | --- | --- |
| `user_uuid` | `auth.users.id` (via `public.user_tenants.user_id`) | Immutable auth user UUID string per tenant membership. |
| `tenant_id` | `public.user_tenants.tenant_id` | Tenant scope for admin listing and authorization. |
| `email` | `auth.users.email` | Always sourced from auth user record. |
| `email_verified` | `auth.users.email_confirmed_at` | `true` when confirmation timestamp exists. |
| `display_name` | `auth.users.raw_user_meta_data.full_name` / `.name` fallback | Falls back to email local-part then `User`. |
| `role` | `public.user_roles.role` fallback `public.user_tenants.role` | Tenant-scoped role and admin authorization display. |
| `status` | `public.user_tenants.status` | Membership lifecycle (`active`, `invited`, `inactive`, etc). |
| `last_login_at` | `auth.users.last_sign_in_at` | Refreshed by auth update triggers and login sync. |
| `creation_source` | `auth.users.raw_app_meta_data.provider` | Fallback `email` when provider metadata missing. |
| `mfa_enrolled` | `public.mfa_secrets.enabled` | Canonical MFA enrollment state. |
| `device_count` | Count of active `public.trusted_devices` by `user_id` | Active = `expires_at > now()`. |
| `device_list_reference` | Constant `'trusted_devices'` | Points to detailed device list system of record. |

## Sync points

Canonical records are refreshed by:

- DB triggers on `auth.users`, `public.user_tenants`, `public.user_roles`, `public.mfa_secrets`, and `public.trusted_devices`.
- Backend service sync calls in:
  - `AdminUserService` for invite/role/remove flows.
  - `MFAService` for enable/disable transitions.
  - `TrustedDeviceService` for trust/revoke flows.
  - Auth API login/signup handlers.

## Drift prevention

- `/api/admin/users` must read from `user_profile_directory` only.
- Any feature introducing user identity/admin fields must either:
  1. update `refresh_user_profile_directory`, or
  2. explicitly document why the field is not canonical.
