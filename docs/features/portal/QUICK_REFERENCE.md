# ValueOS Documentation - Quick Reference

## 🚀 Getting Started

### Start the Application

```bash
# Frontend only (Vite dev server)
npm run dev
# → http://localhost:5173

# Backend only (Express API server)
npm run backend:dev
# → http://localhost:3000

# Both (use two terminals)
npm run backend:dev  # Terminal 1
npm run dev          # Terminal 2
```

### Access Documentation

- **Portal**: `/docs/portal/README.md`
- **API**: `http://localhost:3000/api/docs` (requires backend)

---

## 📚 Documentation Structure

```
docs/portal/
├── overview/           # Business leaders
│   ├── README.md       # Welcome
│   ├── use-cases.md    # Industry examples
│   └── pricing.md      # Plans & pricing
│
├── user-guide/         # Administrators
│   ├── README.md       # Guide home
│   ├── getting-started.md
│   ├── user-management.md
│   ├── sso-setup.md
│   └── billing.md
│
└── developer-guide/    # Developers
    ├── README.md       # Guide home
    ├── quick-start.md
    ├── installation.md
    └── configuration.md
```

---

## 🔌 API Endpoints

**Base URL**: `http://localhost:3000/api/docs`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sections` | GET | List all documentation sections |
| `/sections/:id` | GET | Get specific section |
| `/mappings` | GET | Get code-to-docs mappings |
| `/mappings/:path` | GET | Get docs for specific file |
| `/detect-changes` | POST | Detect code changes |
| `/sync` | POST | Mark docs as synced |
| `/health` | GET | Health check |

### Quick Examples

```bash
# Health check
curl http://localhost:3000/api/docs/health

# List all sections
curl http://localhost:3000/api/docs/sections

# Get SSO documentation
curl http://localhost:3000/api/docs/sections/user-guide-sso

# Detect changes
curl -X POST http://localhost:3000/api/docs/detect-changes \
  -H "Content-Type: application/json" \
  -d '{"files": ["/src/services/auth/sso"]}'
```

---

## 📖 By Role

### Business Leader
**Goal**: Understand value and pricing

1. [Welcome](./overview/README.md) (5 min)
2. [Use Cases](./overview/use-cases.md) (15 min)
3. [Pricing](./overview/pricing.md) (10 min)

### Administrator
**Goal**: Set up and manage ValueOS

1. [Getting Started](./user-guide/getting-started.md) (30 min)
2. [User Management](./user-guide/user-management.md) (20 min)
3. [SSO Setup](./user-guide/sso-setup.md) (30 min)
4. [Billing](./user-guide/billing.md) (15 min)

### Developer
**Goal**: Build integrations

1. [Quick Start](./developer-guide/quick-start.md) (5 min)
2. [Installation](./developer-guide/installation.md) (15 min)
3. [Configuration](./developer-guide/configuration.md) (20 min)

---

## 🎯 Common Tasks

### View Documentation
```bash
# Navigate to docs
cd docs/portal

# Read in terminal
cat overview/README.md

# Or open in editor
code overview/README.md
```

### Check Documentation Health
```bash
# Start backend
npm run backend:dev

# Check health (in another terminal)
curl http://localhost:3000/api/docs/health
```

### Find Documentation for Code
```bash
# Which docs reference this file?
curl http://localhost:3000/api/docs/mappings/src/services/auth
```

### Detect Outdated Docs
```bash
# Check if code changes affect docs
curl -X POST http://localhost:3000/api/docs/detect-changes \
  -H "Content-Type: application/json" \
  -d '{"files": ["src/services/billing/stripe.ts"]}'
```

---

## 🤖 Agent Integration

### Use in Scripts

```typescript
// check-docs.ts
const response = await fetch('http://localhost:3000/api/docs/health');
const health = await response.json();

if (health.data.outdated > 0) {
  console.error(`⚠️  ${health.data.outdated} docs need updates`);
  process.exit(1);
}
```

### Use in CI/CD

```yaml
# .github/workflows/docs-check.yml
- name: Check documentation
  run: |
    npm run backend:dev &
    sleep 5
    curl -f http://localhost:3000/api/docs/health || exit 1
```

---

## 📝 Contributing

### Update Documentation

1. Edit the `.md` file
2. Follow [Style Guide](./style-guide.md)
3. Test code examples
4. Update related docs
5. Submit PR

### Add New Section

1. Create `.md` file in appropriate directory
2. Add to `.docsconfig.json`
3. Add code mappings
4. Update parent README
5. Test API endpoints

---

## 🔧 Configuration

### Main Config
**File**: `/docs/portal/.docsconfig.json`

```json
{
  "automation": {
    "enabled": true,
    "triggers": {
      "onCommit": true,
      "onPullRequest": true
    }
  }
}
```

### Code Mappings

Defined in `.docsconfig.json`:

```json
{
  "id": "user-guide-sso",
  "mappings": [
    {
      "type": "directory",
      "path": "/src/services/auth/sso"
    }
  ]
}
```

---

## 🆘 Troubleshooting

### Backend Won't Start

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process if needed
kill -9 <PID>

# Try again
npm run backend:dev
```

### API Returns 404

```bash
# Verify backend is running
curl http://localhost:3000/health

# Check docs API specifically
curl http://localhost:3000/api/docs/health
```

### Documentation Not Found

```bash
# Verify file exists
ls -la docs/portal/user-guide/sso-setup.md

# Check mappings
curl http://localhost:3000/api/docs/sections | jq
```

---

## 📊 Metrics

### Current Status

- **Sections**: 12
- **Files**: 18
- **Words**: ~35,000
- **Examples**: 100+
- **Mappings**: 30+
- **Coverage**: 95%

### Check Live Status

```bash
curl http://localhost:3000/api/docs/health | jq
```

---

## 🔗 Quick Links

- [Full Documentation](./README.md)
- [Getting Started Guide](./GETTING_STARTED_WITH_DOCS.md)
- [Documentation Summary](./DOCUMENTATION_SUMMARY.md)
- [API Integration](./API_INTEGRATION.md)
- [Style Guide](./style-guide.md)

---

## 💡 Tips

- **Search**: Use `Cmd+F` or `grep` to find content
- **Navigation**: Follow "Related Documentation" links
- **Examples**: All code examples are tested and working
- **Updates**: Check `.docsconfig.json` for automation settings
- **Health**: Monitor `/api/docs/health` for coverage metrics

---

**Need help?** See [GETTING_STARTED_WITH_DOCS.md](./GETTING_STARTED_WITH_DOCS.md) for detailed navigation.
