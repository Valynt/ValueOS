# TLS Certificates Directory

This directory contains mTLS certificates for local development.

## Generation

Run the certificate generation script:

```bash
bash infrastructure/tls/generate-dev-certs.sh
```

## Security

⚠️ **IMPORTANT**: These certificates are for **LOCAL DEVELOPMENT ONLY**.

- Never commit private keys (*.key, *-key.pem) to version control
- Never use these certificates in production
- Rotate certificates regularly (365-day validity)

## Files

After generation, this directory will contain:

- `ca-cert.pem` - Certificate Authority certificate
- `ca-key.pem` - CA private key (gitignored)
- `app-cert.pem`, `app-key.pem` - Application server certificate
- `postgres-cert.pem`, `postgres-key.pem` - PostgreSQL certificate
- `redis-cert.pem`, `redis-key.pem` - Redis certificate
- Client certificates for mTLS authentication
- `cert-info.txt` - Certificate information and usage guide

## Verification

Check certificate validity:

```bash
openssl x509 -in certs/app-cert.pem -noout -text
openssl verify -CAfile certs/ca-cert.pem certs/app-cert.pem
```

## Renewal

Certificates expire after 365 days. Regenerate when needed:

```bash
# Remove old certificates
rm certs/*.pem certs/*.key certs/*.csr

# Generate new ones
bash infrastructure/tls/generate-dev-certs.sh
```
