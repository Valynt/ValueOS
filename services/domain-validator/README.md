# Domain Validator Service

Validates custom domains for Caddy's on-demand TLS feature. This service checks if a domain is verified and belongs to a tenant before Caddy issues an SSL certificate.

## Features

- ✅ Fast domain verification (< 10ms with cache)
- ✅ 5-minute caching to reduce database load
- ✅ Health check endpoint for monitoring
- ✅ Comprehensive logging
- ✅ TypeScript for type safety
- ✅ Production-ready error handling

## Architecture

```
Caddy → /verify?domain=example.com → Domain Validator → Supabase
                                            ↓
                                         Cache (5 min)
```

## API Endpoints

### `GET /verify?domain=<domain>`

Verifies if a domain is verified and belongs to a tenant.

**Query Parameters:**
- `domain` (required) - The domain to verify (e.g., `app.acme.com`)

**Response:**
- `200 OK` - Domain is verified
- `400 Bad Request` - Invalid domain format or missing parameter
- `404 Not Found` - Domain not verified
- `500 Internal Server Error` - Service error

**Example:**
```bash
curl http://localhost:3000/verify?domain=app.acme.com
# Response: OK (200)
```

### `GET /health`

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-08T17:30:00.000Z",
  "cacheSize": 42,
  "uptime": 3600
}
```

### `POST /cache/clear` (Admin only)

Clears the domain cache.

**Response:**
```json
{
  "message": "Cache cleared",
  "clearedCount": 42
}
```

## Installation

```bash
cd services/domain-validator
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (has access to all domains)
- `PORT` - Server port (default: 3000)

## Development

```bash
# Start development server with hot reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint
npm run lint
```

## Production

```bash
# Build
npm run build

# Start production server
npm start
```

## Docker

```bash
# Build image
docker build -t domain-validator .

# Run container
docker run -p 3000:3000 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  domain-validator
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Performance

- **Cache Hit:** < 1ms
- **Cache Miss:** < 50ms (database query)
- **Cache TTL:** 5 minutes
- **Max Cache Size:** 1000 domains

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Metrics

- Cache hit rate
- Response time (p50, p95, p99)
- Error rate
- Active domains

### Logs

Logs are written to stdout in JSON format:

```json
{
  "level": "info",
  "message": "Domain verified",
  "domain": "app.acme.com",
  "cached": true,
  "timestamp": "2025-12-08T17:30:00.000Z"
}
```

## Troubleshooting

### Domain verification fails

1. Check if domain exists in database:
   ```sql
   SELECT * FROM custom_domains WHERE domain = 'app.acme.com';
   ```

2. Check if domain is verified:
   ```sql
   SELECT verified FROM custom_domains WHERE domain = 'app.acme.com';
   ```

3. Check service logs:
   ```bash
   docker logs domain-validator
   ```

### Cache issues

Clear the cache:
```bash
curl -X POST http://localhost:3000/cache/clear
```

### Database connection issues

1. Verify Supabase URL and key
2. Check network connectivity
3. Verify service role key has correct permissions

## Security

- Service uses Supabase service role key (has access to all domains)
- Domain format validation prevents injection attacks
- Rate limiting should be implemented at Caddy level
- Cache prevents database overload

## Related Documentation

- [Custom Domains Schema](../../docs/database/CUSTOM_DOMAINS_SCHEMA.md)
- [Caddy Configuration](../../docs/infrastructure/caddy-configuration.md)
- [Deployment Guide](../../docs/deployment/domain-validator.md)
