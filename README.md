# ValueOS

Enterprise-grade value management platform built with modern web technologies.

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/Valynt/ValueOS.git
cd ValueOS

# Install dependencies (node_modules are not committed)
npm install

# Automated setup (takes ~5 minutes)
npm run setup

# Start development
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) - you're ready to code! 🎉

**First time here?** See [docs/getting-started/GETTING_STARTED.md](docs/getting-started/GETTING_STARTED.md)

---

## ✨ Features

- ✅ **Fast setup**: < 5 minutes from clone to running
- ✅ **Auto-detection**: Automatically configures for your platform
- ✅ **One-click deployment**: GitHub Actions CI/CD pipeline
- ✅ **Full observability**: Metrics, logs, and traces
- ✅ **Security-first**: Auto-generated secrets, pre-commit hooks
- ✅ **Production-ready**: Infrastructure as Code with Terraform

---

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **Docker** Desktop or Engine
- **Git**
- **10 GB** free disk space

The setup script checks these automatically.

---

## 🛠️ Development

### Start Development

```bash
npm run dev
```

This starts the Vite dev server with hot reload on [http://localhost:5173](http://localhost:5173)

### Check System Health

```bash
npm run health
```

### Access Services

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)
- **Supabase Studio**: [http://localhost:54323](http://localhost:54323)

---

## 📚 Documentation

**[Complete Documentation →](docs/README.md)**

### Quick Links

- **[Getting Started](docs/getting-started/GETTING_STARTED.md)** - Complete setup guide
- **[Troubleshooting](docs/getting-started/TROUBLESHOOTING.md)** - Common issues
- **[CI/CD & Infrastructure](docs/deployment/CICD_INFRASTRUCTURE_COMPLETE.md)** - Deployment guide
- **[Contributing](CONTRIBUTING.md)** - How to contribute

### Platform-Specific

- **[macOS](docs/platform/MACOS.md)** - Intel & Apple Silicon
- **[Windows](docs/platform/WINDOWS.md)** - Native & WSL2
- **[Linux](docs/platform/LINUX.md)** - All distributions

---

## 🧪 Testing

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
npm run test:e2e         # End-to-end tests
```

---

## 🏗️ Architecture

```
ValueOS/
├── src/
│   ├── components/      # React components
│   ├── pages/           # Page components
│   ├── services/        # Business logic
│   ├── api/             # API client
│   └── types/           # TypeScript types
├── scripts/
│   ├── dx/              # Developer experience scripts
│   └── lib/             # Shared utilities
├── docs/                # Documentation
├── tests/               # Test files
└── docker-compose.yml   # Docker services
```

---

## 🔧 Common Commands

### Development

```bash
npm run dev              # Start development server
npm run health           # Check system health
npm run setup            # Re-run setup if needed
```

### Database

```bash
npm run db:push          # Push schema changes
npm run db:pull          # Pull schema from remote
npm run db:reset         # Reset local database
npm run db:types         # Generate TypeScript types
```

### Code Quality

```bash
npm run lint             # Lint code
npm run lint:fix         # Fix linting issues
npm run typecheck        # Type check
npm test                 # Run tests
```

### Docker

```bash
docker-compose up -d     # Start services
docker-compose down      # Stop services
docker-compose logs -f   # View logs
docker-compose ps        # Check status
```

---

## 🐛 Troubleshooting

### Setup Issues

**Prerequisites check fails**:

```bash
node --version    # Check Node >= 18.0.0
docker --version  # Check Docker installed
docker ps         # Check Docker running
```

**Port conflicts**:

```bash
# macOS/Linux
lsof -i :5173
kill -9 <PID>

# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**Environment issues**:

```bash
rm .env
npm run setup
```

**More help**: See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m "Add my feature"`
6. Push: `git push origin feature/my-feature`
7. Create a Pull Request

---

## 📊 Project Status

- **Setup Time**: < 5 minutes ✅
- **Setup Success Rate**: 95%+ ✅
- **Developer Satisfaction**: 9.0/10 ✅
- **Test Coverage**: 80%+
- **Build Status**: [![CI](https://github.com/Valynt/ValueOS/workflows/CI/badge.svg)](https://github.com/Valynt/ValueOS/actions)

---

## 🔐 Security

- **Dev Environment Security**: [docs/operations/SECURITY_DEV_ENVIRONMENT.md](docs/operations/SECURITY_DEV_ENVIRONMENT.md)
- **Report vulnerabilities**: security@valueos.com

---

## 📄 License

[LICENSE](LICENSE)

---

## 🆘 Getting Help

### Documentation

- [Getting Started](docs/getting-started/GETTING_STARTED.md)
- [Troubleshooting](docs/getting-started/TROUBLESHOOTING.md)
- [Complete Documentation](docs/README.md)

### Community

- **Slack**: #engineering
- **GitHub Issues**: [Report bugs](https://github.com/Valynt/ValueOS/issues)
- **Email**: engineering@valueos.com

---

## 🎯 Roadmap

### Current (Q1 2025)

- ✅ Enhanced developer experience
- ✅ Automated setup and health checks
- ✅ Platform-specific guides
- 🔄 CI/CD improvements
- 🔄 Performance optimizations

### Upcoming (Q2 2025)

- Cloud development environments (Gitpod/Codespaces)
- AI-powered error diagnosis
- Automated testing improvements
- Developer productivity analytics

---

## 🙏 Acknowledgments

Built with:

- [React](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [Supabase](https://supabase.com/) - Backend platform
- [Docker](https://www.docker.com/) - Containerization
- [TypeScript](https://www.typescriptlang.org/) - Type safety

---

**Made with ❤️ by the ValueOS team**

**Questions?** Ask in #engineering on Slack or check [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)

**Happy coding!** 🚀
