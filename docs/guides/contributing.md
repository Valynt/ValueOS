# Contributing to ValueCanvas

Thank you for your interest in contributing to ValueCanvas! This document provides guidelines and instructions for contributing to the project.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Code Standards](#code-standards)
5. [Testing Guidelines](#testing-guidelines)
6. [Commit Convention](#commit-convention)
7. [Pull Request Process](#pull-request-process)
8. [Documentation](#documentation)
9. [Issue Reporting](#issue-reporting)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all participants to:

- Be respectful and considerate
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling, insulting, or derogatory remarks
- Publishing others' private information
- Any conduct that could be considered inappropriate in a professional setting

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 18+ and npm installed
- Docker Desktop (for local Supabase)
- Supabase CLI installed
- Git configured with your name and email
- A GitHub account

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ValueCanvas.git
   cd ValueCanvas
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/bmsull560/ValueCanvas.git
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Set up environment:**
   ```bash
   cp .env.local .env
   # Edit .env and add your LLM API key
   ```

6. **Start development environment:**
   ```bash
   ./start.sh
   ```

7. **Verify setup:**
   ```bash
   npm test
   npm run lint
   ```

---

## Development Workflow

### Creating a Feature Branch

Always create a new branch for your work:

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Convention

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or updates
- `chore/` - Maintenance tasks

Examples:
- `feature/add-export-functionality`
- `fix/resolve-memory-leak`
- `docs/update-api-documentation`

### Making Changes

1. **Write code** following our [Code Standards](#code-standards)
2. **Add tests** for new functionality
3. **Update documentation** as needed
4. **Run tests** to ensure nothing breaks
5. **Run linting** to check code style

```bash
# Run tests
npm test

# Run linting
npm run lint

# Fix linting issues automatically
npm run lint -- --fix
```

### Keeping Your Branch Updated

Regularly sync with upstream:

```bash
git fetch upstream
```
