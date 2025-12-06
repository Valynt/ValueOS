# Docker Port Forwarding Quick Fix

**Problem:** Caddy/App running but not accessible from Windows browser

---

## 🚀 Quick Fix (2 minutes)

### 1. Run Setup Script

```bash
bash scripts/docker-caddy-setup.sh
```

This will:
- Stop existing containers
- Create necessary secrets
- Start Caddy + App
- Test connectivity

### 2. Access Application

**From Windows Browser:**
- http://localhost
- http://localhost:3000

**From WSL2:**
```bash
curl http://localhost
```

---

## 🔧 If Still Not Working

### Option 1: Restart Docker Desktop

**Windows:**
1. Right-click Docker Desktop tray icon
2. Select "Restart"
3. Wait 30 seconds
4. Try accessing http://localhost again

### Option 2: Check WSL Integration

1. Open Docker Desktop
2. Settings → Resources → WSL Integration
3. Enable your WSL2 distro
4. Click "Apply & Restart"

### Option 3: Windows Firewall

**PowerShell (as Administrator):**
```powershell
New-NetFirewallRule -DisplayName "Docker Port 80" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
```

---

## 🧪 Test Commands

### From WSL2

```bash
# Test app directly
curl http://localhost:3000

# Test Caddy
curl http://localhost

# Test health
curl http://localhost/health

# Check containers
docker-compose -f docker-compose.caddy.yml ps
```

### From Windows PowerShell

```powershell
# Test connectivity
Invoke-WebRequest -Uri http://localhost

# Check if port is listening
netstat -ano | findstr ":80"
```

---

## 📊 Service Status

```bash
# View all services
docker-compose -f docker-compose.caddy.yml ps

# View logs
docker-compose -f docker-compose.caddy.yml logs -f

# Restart specific service
docker-compose -f docker-compose.caddy.yml restart caddy
```

---

## 🆘 Still Having Issues?

### Collect Diagnostics

```bash
# Container status
docker-compose -f docker-compose.caddy.yml ps > diagnostics.txt

# Caddy logs
docker logs valuecanvas-caddy >> diagnostics.txt

# App logs
docker logs valuecanvas-app >> diagnostics.txt

# Network info
docker network inspect valuecanvas_valuecanvas-network >> diagnostics.txt
```

### Common Issues

**1. Port 80 already in use:**
```bash
# Find what's using port 80
lsof -i :80

# Kill the process
kill -9 <PID>
```

**2. Containers not starting:**
```bash
# Check logs
docker-compose -f docker-compose.caddy.yml logs

# Rebuild
docker-compose -f docker-compose.caddy.yml up -d --build
```

**3. WSL2 can access but Windows can't:**
```powershell
# Restart WSL
wsl --shutdown

# Restart Docker Desktop
# (Right-click tray icon → Restart)
```

---

## 📚 Full Documentation

See: `docs/DOCKER_PORT_FORWARDING_FIX.md`

---

**Last Updated:** 2025-12-06
