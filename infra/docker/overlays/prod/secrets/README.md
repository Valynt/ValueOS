# Production Secrets Management

This directory contains sensitive configuration files for production deployment.

## Files

### postgres_password.txt

Contains the PostgreSQL database password.

- Should contain only the password string, no newlines
- Must be readable by the postgres user
- Should be a strong, randomly generated password

### jwt_secret.txt

Contains the JWT signing secret for authentication.

- Should be a cryptographically secure random string
- Minimum 32 characters recommended
- Must be kept secret and rotated regularly

### api_keys.txt

Contains external API keys and service credentials.
Format: `KEY_NAME=value`
Examples:

```
OPENAI_API_KEY=sk-your-openai-key-here
TOGETHER_API_KEY=your-together-api-key
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

## Security Notes

- These files contain sensitive information and should never be committed to version control
- Ensure proper file permissions (600) and ownership
- Rotate secrets regularly according to security policies
- Use environment-specific secrets - never reuse production secrets in staging

## Deployment

The secrets are automatically loaded by Docker Compose when deploying with the production overlay:

```bash
docker compose -f docker-compose.yml -f overlays/prod.yml up
```

## Backup and Recovery

- Secrets should be backed up securely (encrypted)
- Document the process for secret rotation
- Have a recovery plan for compromised secrets
