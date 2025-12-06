# Port Forwarding Quick Fix Guide

**Problem:** Dev server runs but browser can't connect

---

## 🚀 Quick Fix (30 seconds)

```bash
# Run the auto-fix script
npm run dev:fix

# Then restart dev server
npm run dev
```

---

## 🔧 Manual Fix (2 minutes)

### 1. Update Vite Config

Edit `vite.config.ts`:
```typescript
server: {
  host: '0.0.0.0',  // Add this line
  port: 3000,
  cors: true,
}
```

### 2. Restart Dev Server

```bash
# Kill existing process
pkill -f vite

# Clear cache
rm -rf node_modules/.vite

# Start fresh
npm run dev
```

### 3. Access Application

- **Local:** http://localhost:3000
- **Container:** Use forwarded URL from VS Code/Codespaces
- **Gitpod:** Run `gp url 3000` to get URL

---

## 🧪 Playwright Tests Not Working?

### Quick Fix

```bash
# Install browsers
npx playwright install --with-deps

# Run with UI
npx playwright test --ui

# Or headed mode
npx playwright test --headed
```

### Update Config

Edit `playwright.config.ts`:
```typescript
use: {
  baseURL: 'http://localhost:3000',  // Match Vite port
}
```

---

## 🔍 Still Not Working?

### Diagnose

```bash
# Run diagnostics
npm run dev:diagnose

# Test ports
npm run dev:test-ports

# Health check
npm run dev:health
```

### Common Issues

**Port 3000 in use:**
```bash
lsof -ti :3000 | xargs kill -9
```

**Container networking:**
```bash
# Rebuild container
# Cmd/Ctrl + Shift + P > "Dev Containers: Rebuild Container"
```

**Firewall blocking:**
```bash
sudo ufw allow 3000/tcp
```

---

## 📚 Full Documentation

- [Complete Troubleshooting Guide](TROUBLESHOOTING_PORT_FORWARDING.md)
- [Dev Environment Setup](DEV_ENVIRONMENT_SETUP.md)

---

## 🆘 Get Help

```bash
# Collect diagnostics
npm run dev:diagnose > diagnostic.txt

# Share diagnostic.txt with team
```

**Slack:** #dev-support  
**Email:** dev-team@valuecanvas.com

---

**Last Updated:** 2025-12-06
