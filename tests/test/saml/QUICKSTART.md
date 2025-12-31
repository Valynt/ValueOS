# SAML Testing Quick Start

## 5-Minute Setup

### 1. Generate Certificates
```bash
npm run saml:certs
```

### 2. Start SAML Environment
```bash
npm run saml:start
```

Wait ~60 seconds for Keycloak to initialize.

### 3. Verify Services
```bash
# Check Keycloak
curl http://localhost:8080/health/ready

# Check Application
curl http://localhost:5174
```

### 4. Run Tests
```bash
# All SAML tests
npm run test:saml

# Or run individually
npm run test:saml:compliance
npm run test:saml:slo
```

### 5. View Results
```bash
npm run test:saml:report
```

### 6. Cleanup
```bash
npm run saml:stop
```

## Troubleshooting

### Keycloak not starting?
```bash
# Check logs
npm run saml:logs

# Restart
npm run saml:stop
npm run saml:start
```

### Tests failing?
```bash
# Run in headed mode to see browser
npm run test:saml:headed

# Check services are up
docker ps
```

### Port conflicts?
Edit `docker-compose.saml-test.yml` and change ports:
- Keycloak: 8080 → 8081
- App: 5174 → 5175
- Redis: 6380 → 6381

## Test Users

**Valid User:**
- Email: `test.user@valuecanvas.test`
- Password: `Test123!@#`

**Expired User:**
- Email: `expired.user@valuecanvas.test`
- Password: `Expired123!@#`

## Documentation

Full documentation: [test/saml/README.md](./README.md)
