# Troubleshooting Guide

Common issues and solutions for ValueOS development.

---

## Table of Contents

- [Setup Issues](#setup-issues)
- [Docker Issues](#docker-issues)
- [Port Conflicts](#port-conflicts)
- [Environment Issues](#environment-issues)
- [Database Issues](#database-issues)
- [Build Issues](#build-issues)
- [Platform-Specific Issues](#platform-specific-issues)

---

## Setup Issues

### Setup Script Fails

**Symptom**: `pnpm run setup` exits with errors

**Solutions**:

1. **Check prerequisites**:

   ```bash
   node --version    # >= 18.0.0
   docker --version  # Installed
   docker ps         # Running
   ```

2. **Clean and retry**:

   ```bash
   rm -rf node_modules pnpm-lock.yaml .env
   pnpm run setup
   ```

3. **Check disk space**:

   ```bash
   df -h .  # Need >= 10 GB free
   ```

4. **Check permissions**:

   ```bash
   # macOS/Linux
   ls -la
   # Should own the directory

   # Fix if needed
   sudo chown -R $USER:$USER .
   ```

---

### Dependencies Won't Install

**Symptom**: `npm install` or `npm ci` fails

**Solutions**:

1. **Clear npm cache**:

   ```bash
   npm cache clean --force
   rm -rf node_modules pnpm-lock.yaml
   npm install
   ```

2. **Check Node version**:

   ```bash
   node --version
   # Must be >= 18.0.0

   # Update if needed
   nvm install 18
   nvm use 18
   ```

3. **Check network**:

   ```bash
   npm config get registry
   # Should be: https://registry.npmjs.org/

   # Reset if needed
   npm config set registry https://registry.npmjs.org/
   ```

4. **Try with verbose logging**:
   ```bash
   npm install --verbose
   # Look for specific error messages
   ```

---

## Docker Issues

### Docker Not Running

**Symptom**: `Cannot connect to the Docker daemon`

**Solutions**:

**macOS**:

```bash
# Start Docker Desktop
open -a Docker

# Wait for Docker to start (check menu bar icon)
```

**Linux**:

```bash
# Start Docker service
sudo systemctl start docker

# Enable on boot
sudo systemctl enable docker

# Check status
sudo systemctl status docker
```

**Windows**:

- Open Docker Desktop from Start menu
- Wait for "Docker Desktop is running" message

---

### Docker Compose Fails

**Symptom**: `docker-compose up` fails

**Solutions**:

1. **Check Docker Compose version**:

   ```bash
   docker-compose --version
   # Should be >= 2.0.0
   ```

2. **Pull images manually**:

   ```bash
   docker-compose pull
   docker-compose up -d
   ```

3. **Clean and rebuild**:

   ```bash
   docker-compose down -v
   docker-compose up --build
   ```

4. **Check logs**:
   ```bash
   docker-compose logs
   # Look for specific errors
   ```

---

### Containers Keep Restarting

**Symptom**: `docker-compose ps` shows containers restarting

**Solutions**:

1. **Check logs**:

   ```bash
   docker-compose logs <service-name>
   # e.g., docker-compose logs postgres
   ```

2. **Check resource limits**:

   ```bash
   # macOS: Docker Desktop → Preferences → Resources
   # Increase memory to >= 4 GB
   ```

3. **Check port conflicts**:

   ```bash
   # See Port Conflicts section below
   ```

4. **Reset Docker**:
   ```bash
   docker-compose down -v
   docker system prune -a
   docker-compose up -d
   ```

---

## Port Conflicts

### Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::5173` (or your `VITE_PORT`)

**Solutions**:

**macOS/Linux**:

```bash
# Find process using port
lsof -i :5173  # or :$VITE_PORT

# Kill process
kill -9 <PID>

# Or kill all Node processes
pkill -9 node
```

**Windows**:

```powershell
# Find process
netstat -ano | findstr :5173

# Kill process
taskkill /PID <PID> /F
```

**Change Port** (alternative):

```bash
# Frontend
VITE_PORT=5174 npm run dev

# Backend
API_PORT=3002 npm run backend:dev
```

---

### Common Port Conflicts

| Port  | Service         | Solution                             |
| ----- | --------------- | ------------------------------------ |
| 5173  | Vite (Frontend) | `lsof -i :5173` then `kill -9 <PID>` |
| 3001  | Backend         | `lsof -i :3001` then `kill -9 <PID>` |
| 54322 | PostgreSQL      | Stop other Postgres instances        |
| 6379  | Redis           | Stop other Redis instances           |
| 54323 | Supabase Studio | Stop other Supabase instances        |

---

## Environment Issues

### Missing Environment Variables

**Symptom**: `Error: JWT_SECRET is not defined`

**Solutions**:

1. **Check .env file exists**:

   ```bash
   ls -la .env
   # Should exist
   ```

2. **Regenerate .env**:

   ```bash
   rm .env
   pnpm run setup
   ```

3. **Validate .env**:

   ```bash
   pnpm run env:validate
   ```

4. **Check required variables**:
   ```bash
   grep -E "^(NODE_ENV|DATABASE_URL|JWT_SECRET)" .env
   # All should have values
   ```

---

### Weak Secrets Warning

**Symptom**: `Weak JWT secret detected`

**Solution**:

```bash
# Regenerate with secure secrets
rm .env
pnpm run setup
```

---

### Wrong Environment

**Symptom**: Connecting to wrong database/API

**Solutions**:

1. **Check NODE_ENV**:

   ```bash
   grep NODE_ENV .env
   # Should be: development
   ```

2. **Check URLs**:

   ```bash
   grep URL .env
   # Should be localhost URLs
   ```

3. **Never use production credentials locally**:

   ```bash
   # ❌ WRONG
   DATABASE_URL=postgres://prod.supabase.co/...

   # ✅ RIGHT
   DATABASE_URL=postgres://localhost:54322/postgres
   ```

---

## Database Issues

### Cannot Connect to Database

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:54322`

**Solutions**:

1. **Check Docker is running**:

   ```bash
   docker-compose ps postgres
   # Should show "Up"
   ```

2. **Start Docker services**:

   ```bash
   docker-compose up -d
   ```

3. **Check logs**:

   ```bash
   docker-compose logs postgres
   ```

4. **Reset database**:
   ```bash
   docker-compose down -v
   docker-compose up -d
   pnpm run db:reset
   ```

---

### Migration Fails

**Symptom**: `Error: Migration failed`

**Solutions**:

1. **Check database is running**:

   ```bash
   docker-compose ps postgres
   ```

2. **Reset and retry**:

   ```bash
   pnpm run db:reset
   pnpm run db:push
   ```

3. **Check migration files**:

   ```bash
   ls supabase/migrations/
   # Should have .sql files
   ```

4. **Manual migration**:
   ```bash
   pnpm run db:repair
   pnpm run db:push
   ```

---

### Database Connection Pool Exhausted

**Symptom**: `Error: Connection pool exhausted`

**Solutions**:

1. **Restart backend**:

   ```bash
   # Kill backend process
   pkill -9 node
   npm run backend:dev
   ```

2. **Restart database**:

   ```bash
   docker-compose restart postgres
   ```

3. **Check for connection leaks**:
   - Ensure all queries use proper connection handling
   - Check for unclosed connections in code

---

## Build Issues

### Build Fails

**Symptom**: `npm run build` exits with errors

**Solutions**:

1. **Check TypeScript errors**:

   ```bash
   npm run typecheck
   # Fix any type errors
   ```

2. **Check linting**:

   ```bash
   npm run lint
   npm run lint:fix
   ```

3. **Clear build cache**:

   ```bash
   rm -rf dist .vite
   npm run build
   ```

4. **Check dependencies**:
   ```bash
   npm install
   npm run build
   ```

---

### Out of Memory

**Symptom**: `JavaScript heap out of memory`

**Solutions**:

1. **Increase Node memory**:

   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run build
   ```

2. **Close other applications**:
   - Free up system memory
   - Close unused browser tabs

3. **Build in production mode**:
   ```bash
   NODE_ENV=production npm run build
   ```

---

## Platform-Specific Issues

### macOS

#### Rosetta 2 Issues (Apple Silicon)

**Symptom**: `Bad CPU type in executable`

**Solution**:

```bash
# Install Rosetta 2
softwareupdate --install-rosetta
```

#### File Watching Issues

**Symptom**: Hot reload not working

**Solution**:

```bash
# Increase file watcher limit
echo "kern.maxfiles=65536" | sudo tee -a /etc/sysctl.conf
echo "kern.maxfilesperproc=65536" | sudo tee -a /etc/sysctl.conf
sudo sysctl -w kern.maxfiles=65536
sudo sysctl -w kern.maxfilesperproc=65536
```

---

### Windows/WSL2

#### WSL2 Not Installed

**Symptom**: `wsl: command not found`

**Solution**:

```powershell
# In PowerShell (as Administrator)
wsl --install
# Restart computer
```

#### File Permissions Issues

**Symptom**: `EACCES: permission denied`

**Solution**:

```bash
# Keep code in WSL2 filesystem
cd ~
git clone https://github.com/Valynt/ValueOS.git
cd ValueOS

# NOT in /mnt/c/...
```

#### Line Ending Issues

**Symptom**: `'\r': command not found`

**Solution**:

```bash
# Configure git
git config --global core.autocrlf input

# Fix existing files
dos2unix scripts/**/*.sh
```

#### Docker Desktop Integration

**Symptom**: Docker commands fail in WSL2

**Solution**:

1. Open Docker Desktop
2. Settings → Resources → WSL Integration
3. Enable integration with your WSL2 distro
4. Restart WSL2: `wsl --shutdown` then reopen

---

### Linux

#### Docker Permission Denied

**Symptom**: `permission denied while trying to connect to the Docker daemon`

**Solution**:

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Apply changes
newgrp docker

# Or logout and login again
```

#### File Watcher Limit

**Symptom**: `ENOSPC: System limit for number of file watchers reached`

**Solution**:

```bash
# Increase limit
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify
cat /proc/sys/fs/inotify/max_user_watches
```

---

## Still Stuck?

### Collect Debug Information

```bash
# System info
uname -a
node --version
npm --version
docker --version
docker-compose --version

# Check services
docker-compose ps
npm run health

# Check logs
docker-compose logs
```

### Get Help

1. **Check documentation**:
   - [Getting Started](GETTING_STARTED.md)
   - [Platform Guides](platform/)
   - [Security](SECURITY_DEV_ENVIRONMENT.md)

2. **Search existing issues**:
   - [GitHub Issues](https://github.com/Valynt/ValueOS/issues)

3. **Ask for help**:
   - Slack: #engineering
   - Create GitHub issue with:
     - Platform (macOS/Windows/Linux)
     - Node version
     - Error messages
     - Steps to reproduce

4. **Emergency**:
   - Contact: engineering@valueos.com

---

## Prevention

### Best Practices

1. **Keep dependencies updated**:

   ```bash
   npm outdated
   npm update
   ```

2. **Regular cleanup**:

   ```bash
   docker system prune -a
   npm cache clean --force
   ```

3. **Use version managers**:

   ```bash
   # Node.js
   nvm use 18

   # Docker
   # Keep Docker Desktop updated
   ```

4. **Monitor resources**:
   - Check disk space regularly
   - Monitor Docker resource usage
   - Close unused applications

5. **Backup before major changes**:
   ```bash
   pnpm run db:backup
   git stash
   ```

---

## Quick Reference

### Health Check

```bash
npm run health
```

### Reset Everything

```bash
# Nuclear option - resets everything
docker-compose down -v
rm -rf node_modules pnpm-lock.yaml .env
pnpm run setup
```

### Check Logs

```bash
# Docker services
docker-compose logs -f

# Backend
npm run backend:dev  # Check terminal output

# Frontend
# Check browser console
```

### Common Fixes

```bash
# Port conflict
lsof -i :5173 && kill -9 <PID> # or :$VITE_PORT

# Docker issues
docker-compose restart

# Environment issues
rm .env && pnpm run setup

# Dependency issues
rm -rf node_modules && npm install
```

---

**Still having issues?** Ask in #engineering on Slack!
