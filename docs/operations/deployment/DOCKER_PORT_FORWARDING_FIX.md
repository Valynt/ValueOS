# Docker Desktop Port Forwarding Fix

**Issue:** Caddy/App running in Docker but not accessible from Windows browser  
**Environment:** WSL2 + Docker Desktop + Windows

---

## 🔍 Problem Analysis

You have:
- ✅ Caddy container running and healthy
- ✅ App container running on port 5173
- ✅ Internal proxying working (Caddy → App)
- ❌ Port forwarding from Docker to Windows not working

**Root Cause:** Docker Desktop port forwarding issue between WSL2 and Windows

---

## ✅ Solution 1: Fix Port Mapping (Recommended)

### Update infra/docker/docker-compose.dev.yml

The current configuration has the app on port 5173, but your vite.config.ts is set to port 3000. Let's align them:

```yaml
services:
  app:
    ports:
      - "3000:3000"      # Changed from 5173:5173
      - "24678:24678"    # HMR port
    environment:
      - VITE_PORT=3000   # Changed from 5173
```

### Add Caddy Service

```yaml
  caddy:
    image: caddy:2-alpine
    container_name: valuecanvas-caddy
    ports:
      - "80:80"          # HTTP
      - "443:443"        # HTTPS
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    networks:
      - valuecanvas-network
    restart: unless-stopped
    depends_on:
      - app
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  caddy-data:
  caddy-config:
```

### Create Caddyfile

```caddyfile
# Caddyfile for local development
{
    # Disable automatic HTTPS for localhost
    auto_https off
    # Enable admin API
    admin localhost:2019
}

# Main site
:80 {
    # Reverse proxy to Vite dev server
    reverse_proxy app:5173 {
        # Health check
        health_uri /health
        health_interval 10s
        health_timeout 5s
    }

    # Enable compression
    encode gzip

    # Security headers
    header {
        # XSS Protection
        X-XSS-Protection "1; mode=block"
        # Prevent MIME sniffing
        X-Content-Type-Options "nosniff"
        # Clickjacking protection
        X-Frame-Options "SAMEORIGIN"
        # Remove server header
        -Server
    }

    # Logging
    log {
        output stdout
        format json
    }
}

# Health check endpoint
:80/health {
    respond "healthy" 200
}
```

---

## ✅ Solution 2: Docker Desktop Settings

### 1. Restart Docker Desktop

```powershell
# In PowerShell (as Administrator)
Restart-Service docker
```

Or manually:
1. Right-click Docker Desktop tray icon
2. Select "Restart"
3. Wait for Docker to fully restart

### 2. Check WSL Integration

1. Open Docker Desktop
2. Go to **Settings** → **Resources** → **WSL Integration**
3. Ensure your WSL2 distro is enabled
4. Click **Apply & Restart**

### 3. Verify Port Forwarding

```powershell
# In PowerShell, check if ports are listening
netstat -ano | findstr ":80"
netstat -ano | findstr ":3000"
```

---

## ✅ Solution 3: Windows Firewall

### Allow Docker Desktop

```powershell
# In PowerShell (as Administrator)
New-NetFirewallRule -DisplayName "Docker Desktop" -Direction Inbound -Program "C:\Program Files\Docker\Docker\Docker Desktop.exe" -Action Allow

# Allow specific ports
New-NetFirewallRule -DisplayName "Docker Port 80" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Docker Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

---

## ✅ Solution 4: Use host.docker.internal

### Update Caddyfile

```caddyfile
:80 {
    # Use host.docker.internal to access host network
    reverse_proxy host.docker.internal:3000
}
```

### Update docker-compose.yml

```yaml
services:
  app:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

---

## ✅ Solution 5: Network Mode Host (Linux Only)

**Note:** This only works on Linux, not Windows/Mac

```yaml
services:
  app:
    network_mode: "host"
    # Remove ports section when using host mode
```

---

## 🧪 Testing

### From WSL2

```bash
# Test app directly
curl http://localhost:3000

# Test Caddy
curl http://localhost:80

# Test health endpoint
curl http://localhost:80/health
```

### From Windows

```powershell
# Test in PowerShell
Invoke-WebRequest -Uri http://localhost
Invoke-WebRequest -Uri http://localhost:3000

# Or in browser
# http://localhost
# http://localhost:3000
```

### Docker Logs

```bash
# Check Caddy logs
docker logs valuecanvas-caddy

# Check app logs
docker logs valuecanvas-dev

# Follow logs
docker logs -f valuecanvas-caddy
```

---

## 🔧 Complete Setup Script

Create `scripts/docker-setup.sh`:

```bash
#!/bin/bash

echo "🐳 Setting up Docker environment..."

# 1. Stop existing containers
docker-compose down

# 2. Create secrets directory
mkdir -p secrets
echo "dev_password_123" > secrets/dev_db_password.txt
echo "dev_redis_456" > secrets/dev_redis_password.txt

# 3. Create Caddyfile
cat > Caddyfile << 'EOF'
{
    auto_https off
    admin localhost:2019
}

:80 {
    reverse_proxy app:5173
    encode gzip
    header {
        X-XSS-Protection "1; mode=block"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        -Server
    }
    log {
        output stdout
        format json
    }
}

:80/health {
    respond "healthy" 200
}
EOF

# 4. Start services
docker-compose up -d

# 5. Wait for services
echo "⏳ Waiting for services to start..."
sleep 10

# 6. Test connectivity
echo "🧪 Testing connectivity..."
curl -f http://localhost:80/health && echo "✅ Caddy is healthy" || echo "❌ Caddy not accessible"
curl -f http://localhost:3000 && echo "✅ App is accessible" || echo "❌ App not accessible"

echo "✅ Setup complete!"
echo "Access your app at: http://localhost"
```

---

## 🐛 Troubleshooting

### Issue: "Connection refused"

**Check if containers are running:**
```bash
docker ps
```

**Check if ports are bound:**
```bash
docker port valuecanvas-caddy
docker port valuecanvas-dev
```

**Check container logs:**
```bash
docker logs valuecanvas-caddy
docker logs valuecanvas-dev
```

### Issue: "Port already in use"

**Find what's using the port:**
```bash
# On WSL2
lsof -i :80
lsof -i :3000

# On Windows (PowerShell)
netstat -ano | findstr ":80"
```

**Kill the process:**
```bash
# On WSL2
kill -9 <PID>

# On Windows (PowerShell as Admin)
Stop-Process -Id <PID> -Force
```

### Issue: "Cannot connect from Windows"

**1. Check Docker Desktop is running**
```powershell
docker version
```

**2. Restart Docker Desktop**
- Right-click tray icon → Restart

**3. Check WSL2 integration**
- Docker Desktop → Settings → Resources → WSL Integration

**4. Test from WSL2 first**
```bash
curl http://localhost:80
```

**5. If WSL2 works but Windows doesn't:**
```powershell
# Restart WSL
wsl --shutdown
# Then restart Docker Desktop
```

---

## 📊 Port Reference

| Service | Container Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| Caddy | 80 | 80 | HTTP |
| Caddy | 443 | 443 | HTTPS |
| Caddy Admin | 2019 | - | Admin API |
| App (Vite) | 3000 | 3000 | Dev Server |
| App (HMR) | 24678 | 24678 | Hot Reload |
| PostgreSQL | 5432 | 5432 | Database |
| Redis | 6379 | 6379 | Cache |

---

## 🚀 Quick Commands

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# Restart Caddy
docker-compose restart caddy

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose up -d --build

# Check health
docker-compose ps
```

---

## 📚 Additional Resources

- [Docker Desktop WSL2 Backend](https://docs.docker.com/desktop/windows/wsl/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [Docker Compose Networking](https://docs.docker.com/compose/networking/)

---

**Last Updated:** 2025-12-06  
**Status:** Ready for deployment
