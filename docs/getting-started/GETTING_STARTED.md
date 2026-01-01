# Getting Started with ValueOS

Welcome to ValueOS! This guide will help you set up your local development environment in less than 5 minutes.

---

## Quick Start

```bash
# Clone repository
git clone https://github.com/Valynt/ValueOS.git
cd ValueOS

# Run automated setup
npm run setup

# Start development
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to see the app!

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **Docker** Desktop or Engine ([Download](https://www.docker.com/))
- **Git** ([Download](https://git-scm.com/))
- **10 GB** free disk space

The setup script will check these for you.

---

## Platform-Specific Setup

### macOS

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@18

# Install Docker Desktop
brew install --cask docker

# Start Docker
open -a Docker
```

**Apple Silicon (M1/M2)**: Everything works natively! No special configuration needed.

**Intel Mac**: Works great, but consider upgrading to Apple Silicon for better performance.

See [docs/platform/MACOS.md](platform/MACOS.md) for detailed instructions.

---

### Windows (WSL2 Recommended)

**Option 1: WSL2 (Recommended)**

```powershell
# Install WSL2
wsl --install

# Restart computer

# Inside WSL2:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y docker.io
```

**Option 2: Native Windows**

- Install [Node.js](https://nodejs.org/)
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Use PowerShell or Git Bash

See [docs/platform/WINDOWS.md](platform/WINDOWS.md) for detailed instructions.

---

### Linux

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y docker.io

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Increase file watcher limit
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

See [docs/platform/LINUX.md](platform/LINUX.md) for other distributions.

---

## Automated Setup

The `npm run setup` command will:

1. ✅ Detect your platform (macOS/Windows/Linux)
2. ✅ Check prerequisites (Node, Docker, disk space)
3. ✅ Generate secure environment configuration
4. ✅ Install dependencies
5. ✅ Start Docker services
6. ✅ Verify everything is working

**Time**: ~3-5 minutes on most systems

---

## Manual Setup (If Needed)

If automated setup fails, you can set up manually:

### 1. Environment Configuration

```bash
# Copy template
cp .env.example .env

# Edit .env and set:
# - JWT_SECRET (generate with: openssl rand -hex 32)
# - DATABASE_URL
# - Other required variables
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Docker Services

```bash
docker-compose up -d
```

### 4. Verify Setup

```bash
npm run health
```

---

## Development Workflow

### Start All Services

```bash
# Unified command (recommended)
npm run dev

# Or start individually:
npm run dev              # Frontend only
npm run backend:dev      # Backend only
docker-compose up        # Docker services
```

### Check System Health

```bash
npm run health
```

Output:
```
🏥 Running health checks...

✅ Backend API       http://localhost:3000/health
✅ Frontend          http://localhost:5173
✅ PostgreSQL        localhost:54322
✅ Redis             localhost:6379
✅ Environment       All required vars set

All systems operational! 🎉
```

### Access Services

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)
- **Supabase Studio**: [http://localhost:54323](http://localhost:54323)
- **API Docs**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

---

## Common Commands

```bash
# Development
npm run dev              # Start frontend dev server
npm run backend:dev      # Start backend dev server
npm run dev      # Start all services

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage

# Database
npm run db:push          # Push schema changes
npm run db:pull          # Pull schema from remote
npm run db:reset         # Reset local database
npm run db:types         # Generate TypeScript types

# Docker
docker-compose up -d     # Start services
docker-compose down      # Stop services
docker-compose logs -f   # View logs
docker-compose ps        # Check status

# Code Quality
npm run lint             # Lint code
npm run lint:fix         # Fix linting issues
npm run typecheck        # Type check
```

---

## Troubleshooting

### Setup Fails

**Check prerequisites**:
```bash
node --version    # Should be >= 18.0.0
docker --version  # Should be installed
docker ps         # Docker should be running
```

**Clean and retry**:
```bash
rm -rf node_modules package-lock.json .env
npm run setup
```

### Port Already in Use

**Find and kill process**:
```bash
# macOS/Linux
lsof -i :5173  # or :3000, :54322, etc.
kill -9 <PID>

# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Docker Issues

**Restart Docker**:
```bash
# macOS
killall Docker && open -a Docker

# Linux
sudo systemctl restart docker

# Windows
Restart Docker Desktop
```

**Check Docker status**:
```bash
docker-compose ps
docker-compose logs
```

### Environment Variables Missing

**Regenerate .env**:
```bash
rm .env
npm run setup
```

### More Help

- **Troubleshooting Guide**: [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Platform Guides**: [docs/platform/](platform/)
- **Security**: [docs/SECURITY_DEV_ENVIRONMENT.md](SECURITY_DEV_ENVIRONMENT.md)
- **Slack**: #engineering

---

## Next Steps

### 1. Explore the Codebase

```
ValueOS/
├── src/
│   ├── components/     # React components
│   ├── pages/          # Page components
│   ├── services/       # Business logic
│   ├── api/            # API client
│   └── types/          # TypeScript types
├── scripts/            # Build and dev scripts
├── docs/               # Documentation
└── tests/              # Test files
```

### 2. Make Your First Change

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Test: `npm test`
4. Commit: `git commit -m "Add my feature"`
5. Push: `git push origin feature/my-feature`
6. Create Pull Request

### 3. Read the Docs

- **Contributing**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Architecture**: [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- **API Reference**: [docs/API.md](API.md)
- **Testing**: [docs/TESTING.md](TESTING.md)

---

## Development Tips

### Hot Reload

Both frontend and backend support hot reload:
- **Frontend**: Vite automatically reloads on file changes
- **Backend**: tsx watch restarts on file changes

### Database Changes

```bash
# Create migration
npm run db:migration:create my_migration

# Apply migrations
npm run db:push

# Generate types
npm run db:types
```

### Debugging

**Frontend**:
- Use React DevTools browser extension
- Check browser console
- Use `console.log()` or debugger

**Backend**:
- Check terminal output
- Use `console.log()` or debugger
- View logs: `docker-compose logs backend`

### Performance

**Frontend**:
- Use React DevTools Profiler
- Check Network tab for slow requests
- Use Lighthouse for audits

**Backend**:
- Check response times in logs
- Use database query logging
- Profile with Node.js inspector

---

## Getting Help

### Documentation

- **This Guide**: You're reading it!
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Platform Guides**: [docs/platform/](platform/)
- **API Docs**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

### Community

- **Slack**: #engineering (for questions)
- **GitHub Issues**: [Report bugs](https://github.com/Valynt/ValueOS/issues)
- **Pull Requests**: [Contribute](https://github.com/Valynt/ValueOS/pulls)

### Support

If you're stuck:
1. Check [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Search existing GitHub issues
3. Ask in #engineering on Slack
4. Create a GitHub issue with:
   - Platform (macOS/Windows/Linux)
   - Node version (`node --version`)
   - Error messages
   - Steps to reproduce

---

## Success!

You're all set! 🎉

**What's Next?**
- Explore the codebase
- Pick up a task from Linear/Jira
- Make your first contribution
- Help improve these docs

**Questions?** Ask in #engineering on Slack.

**Happy coding!** 🚀
