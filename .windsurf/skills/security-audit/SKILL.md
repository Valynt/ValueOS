---
name: security-audit
description: Runs security tools, dependency scans, and enforcement checks
---

# Security Audit

This skill provides comprehensive security validation procedures including vulnerability scanning, dependency analysis, secrets detection, and compliance enforcement for the ValueOS codebase.

## When to Run

Run this skill when:
- Before production deployments
- After adding new dependencies
- During scheduled security reviews
- When investigating security incidents
- Before major releases
- After security patches or updates
- During CI/CD pipeline validation

## Security Assessment Framework

### Security Domains
- **Application Security**: Code analysis, vulnerability scanning
- **Dependency Security**: Supply chain risk assessment
- **Infrastructure Security**: Container and configuration scanning
- **Secrets Management**: Credential detection and validation
- **Compliance**: Regulatory and organizational requirements

### Risk Levels
- **Critical**: Immediate threat to production systems
- **High**: Significant security vulnerability
- **Medium**: Moderate security concern
- **Low**: Minor security improvement opportunity
- **Info**: Security best practice recommendations

## Application Security Scanning

### Static Application Security Testing (SAST)

#### Semgrep Security Rules
```bash
# Run comprehensive security scan
semgrep --config auto --severity ERROR --severity WARNING

# Scan for specific vulnerability types
semgrep --config p/security --include="src/"

# Custom security rules for ValueOS
semgrep --config .semgrep/rules.yaml

# Generate SARIF report for CI integration
semgrep --config auto --sarif --output security-results.sarif
```

#### ESLint Security Rules
```javascript
// .eslintrc.js security configuration
module.exports = {
  plugins: ['security'],
  rules: {
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-unsafe-regex': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error'
  }
}
```

### Dynamic Application Security Testing (DAST)
```bash
# OWASP ZAP baseline scan
docker run -v $(pwd):/zap/wrk owasp/zap2docker-stable zap-baseline.py \
  -t https://staging.valueos.com \
  -r zap-report.html

# API security testing with Postman
newman run security-tests.postman_collection.json \
  --environment staging.postman_environment.json

# Load testing with security checks
k6 run --tag security=true tests/security/load-test.js
```

## Dependency Security Analysis

### npm Audit Integration
```bash
# Run dependency vulnerability scan
pnpm audit

# Audit with specific severity levels
pnpm audit --audit-level=moderate

# Generate detailed audit report
pnpm audit --json | jq '.vulnerabilities | to_entries | map(.value) | sort_by(.severity)'

# Fix automatically resolvable vulnerabilities
pnpm audit fix

# Force fix including breaking changes
pnpm audit fix --force
```

### Software Composition Analysis (SCA)

#### Snyk Integration
```bash
# Authenticate with Snyk
snyk auth

# Test for vulnerabilities
snyk test

# Test specific package
snyk test @valueos/backend

# Monitor for new vulnerabilities
snyk monitor

# Generate dependency tree
snyk test --print-deps
```

#### Dependency Check
```bash
# OWASP Dependency Check
dependency-check --project "ValueOS" \
  --scan . \
  --format ALL \
  --out dependency-check-report

# Check for outdated dependencies
pnpm outdated

# Analyze dependency licenses
pnpm licenses list --json | jq '.[] | select(.licenseType | contains("GPL"))'
```

### License Compliance
```bash
# Generate license report
license-checker --json > licenses.json

# Check for forbidden licenses
license-checker --failOn "GPL;LGPL;MS-PL" > /dev/null

# SPDX license validation
reuse lint
```

## Secrets and Credential Detection

### GitLeaks Advanced Scanning
```bash
# Comprehensive secrets scan
gitleaks detect --verbose --redact --config .gitleaks.toml

# Scan specific commits
gitleaks detect --commit=HEAD~10

# Generate report
gitleaks detect --report-format=json --report-path=secrets-report.json

# Baseline scan (ignore known false positives)
gitleaks detect --baseline-path=.gitleaks-baseline.json
```

### TruffleHog Enterprise Scanning
```bash
# Filesystem scan
trufflehog filesystem --directory=. --only-verified

# Git repository scan
trufflehog git file://. --only-verified

# Docker image scan
trufflehog docker --image valueos/backend:latest

# Custom regex patterns
trufflehog filesystem --directory=. --regex --rules=security-patterns.yaml
```

### Credential Validation
```bash
# Test API keys and tokens
./scripts/validate-credentials.sh

# Check database connection security
./scripts/test-db-security.sh

# Validate SSL certificates
openssl s_client -connect api.valueos.com:443 -servername api.valueos.com

# Check for hardcoded secrets
grep -r "password\|secret\|key" --include="*.ts" --include="*.js" src/
```

## Infrastructure Security Scanning

### Container Image Security
```bash
# Trivy comprehensive scan
trivy image --format json --output trivy-results.json valueos/backend:latest

# Scan for critical vulnerabilities only
trivy image --severity CRITICAL valueos/backend:latest

# SBOM generation
trivy image --format spdx-json valueos/backend:latest

# Configuration scanning
trivy config --format json kubernetes/
```

### Kubernetes Security
```bash
# Kube-bench cluster security assessment
kube-bench run --targets master,node,etcd,policies

# Kube-hunter active scanning
kube-hunter --remote scanning

# RBAC analysis
kubectl auth can-i --list

# Network policy validation
kubectl get networkpolicies -A
```

### Infrastructure as Code Security
```bash
# Terraform security scanning
checkov -f infrastructure/ --framework terraform

# CloudFormation security
checkov -f infrastructure/ --framework cloudformation

# Kubernetes manifest security
checkov -f k8s/ --framework kubernetes

# Docker security
checkov -f Dockerfile --framework dockerfile
```

## Compliance and Regulatory Checks

### SOX Compliance (Financial Controls)
```bash
# Access control validation
./scripts/audit-access-controls.sh

# Change management verification
./scripts/audit-change-management.sh

# Financial data protection checks
./scripts/audit-financial-data.sh
```

### GDPR Compliance (Data Protection)
```bash
# Personal data mapping
./scripts/gdpr-data-mapping.sh

# Consent mechanism validation
./scripts/gdpr-consent-check.sh

# Data retention policy enforcement
./scripts/gdpr-retention-check.sh

# Right to erasure implementation
./scripts/gdpr-erasure-check.sh
```

### SOC 2 Compliance
```bash
# Security controls assessment
./scripts/soc2-security-controls.sh

# Availability monitoring
./scripts/soc2-availability-check.sh

# Confidentiality measures
./scripts/soc2-confidentiality-check.sh

# Processing integrity validation
./scripts/soc2-processing-integrity.sh
```

## Automated Security Workflows

### CI/CD Security Pipeline
```yaml
name: Security Audit
on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: '0 2 * * 1'  # Weekly security scan

jobs:
  security-scan:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: auto
          generateSarif: "1"

      - name: Upload Semgrep results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: semgrep.sarif

      - name: Run TruffleHog
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
          extra_args: --debug --only-verified

      - name: Dependency audit
        run: |
          pnpm audit --audit-level=high
          pnpm audit --json | jq '.metadata.vulnerabilities.total > 0' && exit 1 || echo "No high/critical vulnerabilities"

      - name: Container scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'image'
          scan-ref: 'valueos/backend:latest'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: trivy-results.sarif
```

### Automated Remediation
```bash
# Auto-fix script for common issues
#!/bin/bash

echo "Running automated security fixes..."

# Fix file permissions
find . -type f -name "*.sh" -exec chmod +x {} \;

# Remove debug code
sed -i '/console\.log/d' dist/*.js

# Update dependencies
pnpm update --latest

# Regenerate lockfile
pnpm install

echo "Security fixes applied"
```

## Security Monitoring and Alerting

### Real-time Security Monitoring
```bash
# Security event logging
curl -X POST $SECURITY_ENDPOINT \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"security_scan_completed\",
    \"vulnerabilities_found\": $VULN_COUNT,
    \"severity\": \"$MAX_SEVERITY\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }"
```

### Alert Thresholds
- **Critical Vulnerabilities**: Immediate alert to security team
- **High Vulnerabilities**: Alert within 24 hours
- **Secrets Detected**: Immediate alert and repository lockdown
- **License Violations**: Alert to legal team
- **Compliance Failures**: Escalated to compliance officer

## Security Training and Awareness

### Developer Security Training
- **Secure Coding Practices**: OWASP Top 10 awareness
- **Dependency Management**: Supply chain security
- **Secrets Handling**: Proper credential management
- **Incident Response**: Security breach procedures

### Security Champions Program
- **Code Reviews**: Security-focused review checklists
- **Threat Modeling**: Application threat assessments
- **Security Testing**: Integration into development workflow
- **Knowledge Sharing**: Security best practices documentation

## Incident Response Integration

### Security Incident Workflow
```yaml
# Incident response automation
name: Security Incident
on:
  workflow_dispatch:
    inputs:
      severity:
        description: 'Incident severity'
        required: true
        default: 'medium'
        type: choice
        options:
          - critical
          - high
          - medium
          - low

jobs:
  incident-response:
    runs-on: ubuntu-latest
    steps:
      - name: Log incident
        run: |
          echo "Security incident logged: ${{ inputs.severity }}"
          # Notify security team
          # Create incident ticket
          # Initiate response procedures
```

### Forensic Analysis Tools
```bash
# Log analysis for security events
grep "SECURITY" application.log | tail -100

# Network traffic analysis
tcpdump -i eth0 -w security-incident.pcap

# Memory dump analysis
gcore -o memory-dump $PROCESS_ID

# File integrity checking
find /app -type f -exec sha256sum {} \; > file-hashes.txt
```

## Continuous Security Improvement

### Security Metrics Tracking
- **Vulnerability Density**: Vulnerabilities per 1000 lines of code
- **Mean Time to Remediation**: Average time to fix security issues
- **Security Debt**: Outstanding security issues over time
- **Compliance Score**: Percentage of compliance requirements met

### Retrospective and Improvement
- **Monthly Security Reviews**: Assess security posture
- **Threat Intelligence Integration**: Stay updated on emerging threats
- **Security Tool Updates**: Keep scanning tools current
- **Process Improvements**: Refine security workflows based on incidents

This comprehensive security audit framework ensures robust protection across all layers of the ValueOS platform.
