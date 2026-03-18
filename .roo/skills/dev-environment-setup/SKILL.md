---
name: dev-environment-setup
description: Automated development environment validation and setup. Use to ensure proper configuration of Supabase, Redis, ports, and dependencies for ValueOS development.
license: MIT
compatibility: ValueOS development environment
metadata:
  author: ValueOS
  version: "1.0"
  generatedBy: "1.2.0"
---

# Development Environment Setup Skill

Automated development environment validation and setup for ValueOS development, ensuring proper configuration of Supabase, Redis, ports, and dependencies.

## When to Use

- Initial development environment setup
- Troubleshooting environment issues
- After pulling latest code changes
- Before starting development work
- When switching between projects
- During onboarding of new developers

## Input

- **fixMode**: Auto-fix mode (--fix flag)
- **quickMode**: Quick check mode (--quick flag)
- **verboseMode**: Verbose output (--verbose flag)
- **skipServices**: Skip specific service checks (comma-separated)
- **envFile**: Custom environment file path
- **portRange**: Port range for availability checks

## Output

Comprehensive environment status report including:

- Service connectivity status
- Configuration validation results
- Port availability checks
- Dependency version verification
- Auto-fix recommendations
- Setup completion status

## Implementation Steps

1. **Environment File Validation**
   - Check for required environment variables
   - Validate .env.local and .env.ports files
   - Verify placeholder values are replaced
   - Check for sensitive data exposure

2. **Supabase Connection Testing**
   - Test database connectivity
   - Validate authentication credentials
   - Check RLS policy configuration
   - Verify migration status

3. **Redis Connection Testing**
   - Test Redis server connectivity
   - Validate authentication and TLS settings
   - Check memory configuration
   - Verify persistence settings

4. **Port Availability Checking**
   - Check frontend port (default: 5173)
   - Verify backend port (default: 3001)
   - Validate database port (default: 5432)
   - Check Redis port (default: 6379)

5. **Dependency Validation**
   - Verify Node.js version compatibility
   - Check pnpm installation and version
   - Validate package dependencies
   - Check for security vulnerabilities

6. **Service Health Checks**
   - Test LLM provider connectivity
   - Validate API key permissions
   - Check rate limiting configuration
   - Verify fallback mechanisms

## Service Checks

### Supabase Database

```bash
✅ Database connection: OK
✅ Authentication: OK
✅ RLS policies: Configured
✅ Migrations: Current
❌ Connection pool: High latency (500ms)
```

### Redis Cache

```bash
✅ Redis connection: OK
✅ Authentication: OK
✅ TLS encryption: Enabled
✅ Memory usage: 45% (OK)
❌ Persistence: Disabled (development mode)
```

### Port Availability

```bash
✅ Frontend port 5173: Available
✅ Backend port 3001: Available
✅ Database port 5432: Available
❌ Redis port 6379: In use by other process
```

### Dependencies

```bash
✅ Node.js v18.17.0: Compatible
✅ pnpm v8.6.0: Compatible
✅ TypeScript v5.0.0: Compatible
❌ @valueos/backend: Build errors detected
```

## Auto-fix Capabilities

### Environment Configuration

- Generate missing .env files
- Replace placeholder values
- Set development-specific configurations
- Configure local service URLs

### Port Conflicts

- Automatically find available ports
- Update configuration files
- Restart services with new ports
- Update documentation

### Dependency Issues

- Install missing dependencies
- Update incompatible versions
- Fix security vulnerabilities
- Configure build tools

## Example Usage

```bash
# Basic environment check
/dev-environment-setup

# Quick check (skip time-consuming tests)
/dev-environment-setup --quick

# Full check with auto-fix
/dev-environment-setup --fix --verbose

# Check specific services only
/dev-environment-setup --skipServices="redis,llm" --verbose

# Custom environment file
/dev-environment-setup --envFile=".env.development.local"

# Check before starting development
/dev-environment-setup --quick && pnpm run dev
```

## Fix Categories

### Safe Fixes (Applied Automatically)

- Generate missing environment files
- Update port configurations
- Install missing dependencies
- Set development-specific settings

### Review Required (Prompt User)

- Replace production credentials
- Update database connections
- Modify security settings
- Change service configurations

## Integration with DX Doctor

This skill integrates with and enhances the existing DX doctor functionality:

```javascript
// Enhanced DX doctor integration
const dxCheck = await runDXDoctor({
  softMode: true,
  autoShiftPorts: true,
  allowEnvPlaceholders: false,
});

const skillCheck = await runDevEnvironmentSetup({
  fixMode: true,
  verboseMode: true,
});

// Combine results for comprehensive report
const combinedReport = mergeReports(dxCheck, skillCheck);
```

## Performance Optimization

### Caching Strategy

- Cache service connectivity results (5-minute TTL)
- Store dependency validation results
- Cache port availability checks
- Remember successful configurations

### Parallel Processing

- Concurrent service checks
- Parallel dependency validation
- Simultaneous port scanning
- Async file operations

## Error Recovery

### Service Failures

- Retry with exponential backoff
- Fallback to alternative services
- Provide manual setup instructions
- Suggest configuration changes

### Configuration Issues

- Backup original files
- Provide rollback mechanisms
- Generate recovery scripts
- Create detailed error logs

## Development Workflow Integration

### Git Hooks

```bash
# Pre-commit hook
#!/bin/bash
/dev-environment-setup --quick
if [ $? -ne 0 ]; then
  echo "Environment check failed. Run /dev-environment-setup --fix"
  exit 1
fi
```

### IDE Integration

- VS Code tasks for environment checks
- Automatic environment validation
- Inline error reporting
- Quick fix suggestions

## Monitoring and Analytics

### Usage Metrics

- Environment check frequency
- Auto-fix success rates
- Common failure patterns
- Setup time improvements

### Performance Metrics

- Check execution time
- Service response times
- Fix application speed
- User satisfaction scores

## Best Practices Enforced

- Always validate environment before development
- Use consistent service configurations
- Keep dependencies updated
- Document environment setup steps
- Test in isolated environments
- Monitor service health regularly
