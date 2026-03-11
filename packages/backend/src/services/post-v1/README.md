# post-v1 Services

Services in this directory are deferred — they are not part of the v1 launch scope and must not be imported at startup unless their feature flag is explicitly enabled.

See `packages/backend/src/config/v1-service-scope.ts` for the authoritative list.

Do not add new imports of these files to routes, server.ts, or any v1 service without first moving the service to the active `services/` directory and updating `v1-service-scope.ts`.
