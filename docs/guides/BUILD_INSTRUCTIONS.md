# Build Instructions

## Prerequisites

- Docker Engine 20.10+
- Source code with valid `package.json` and `tsconfig.json`

## Building the Optimized Image

Run the following command from the repository root:

```bash
docker build -f Dockerfile.optimized -t valuecanvas-optimized:latest .
```

### Verification

1.  **Check Size**:
    ```bash
    docker images valuecanvas-optimized:latest
    ```
    *Target size: < 200MB*

2.  **Verify Non-Root User**:
    ```bash
    docker run --rm valuecanvas-optimized:latest id
    ```
    *Output should be: `uid=1000(node) gid=1000(node)...`*

3.  **Verify Read-Only Root Filesystem (Optional Hardening)**:
    You can run the container with a read-only filesystem for extra security:
    ```bash
    docker run --read-only --tmpfs /tmp valuecanvas-optimized:latest
    ```

## Running the Container

```bash
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e VITE_SUPABASE_URL=your_url \
  -e VITE_SUPABASE_ANON_KEY=your_key \
  --name valuecanvas-app \
  valuecanvas-optimized:latest
```

## Troubleshooting

-   **Build Failures**: If the build fails at the `esbuild` step, ensure `src/backend/server.ts` is valid TypeScript. The `esbuild` configuration is set to ignore minor type errors to ensure a build artifact is produced, but syntax errors will fail the build.
-   **Healthcheck Failures**: If the container starts but becomes unhealthy, check the logs (`docker logs valuecanvas-app`). Ensure the server is actually listening on port 3000.
