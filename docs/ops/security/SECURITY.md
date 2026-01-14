# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of ValueCanvas seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Where to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

**security@valuecanvas.com**

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-14 days
  - Medium: 14-30 days
  - Low: 30-90 days

### Disclosure Policy

- We will acknowledge receipt of your vulnerability report
- We will confirm the vulnerability and determine its impact
- We will release a fix as soon as possible
- We will publicly disclose the vulnerability after a fix is released
- We will credit you for the discovery (unless you prefer to remain anonymous)

## Security Measures

### Current Security Implementations

1. **Authentication & Authorization**
   - Supabase Auth with JWT tokens
   - Row Level Security (RLS) on all database tables
   - Role-based access control (RBAC)
   - Session management with automatic expiration

2. **Data Protection**
   - Encryption at rest (Supabase)
   - Encryption in transit (HTTPS/TLS)
   - Input validation with Zod schemas
   - Output encoding with sanitizeHtml
   - SQL injection prevention (parameterized queries)

3. **API Security**
   - Rate limiting
   - CORS configuration
   - API key authentication
   - Request validation
   - Error handling without information leakage

4. **Frontend Security**
   - Content Security Policy (CSP)
   - XSS prevention
   - CSRF protection
   - Secure cookie settings
   - Subresource Integrity (SRI)

5. **Infrastructure Security**
   - Regular dependency updates
   - Automated security scanning
   - Vulnerability monitoring
   - Security headers
   - DDoS protection

### Security Best Practices

#### For Developers

1. **Code Review**
   - All code must be reviewed before merging
   - Security-focused review for sensitive changes
   - Automated security checks in CI/CD

2. **Dependencies**
   - Keep dependencies up to date
   - Review dependency changes
   - Use `npm audit` regularly
   - Monitor Dependabot alerts

3. **Secrets Management**
   - Never commit secrets to git
   - Use environment variables
   - Rotate secrets regularly
   - Use secret management tools

4. **Input Validation**
   - Validate all user inputs
   - Use type-safe schemas (Zod)
   - Sanitize outputs
   - Implement rate limiting

5. **Error Handling**
   - Don't expose stack traces
   - Log errors securely
   - Use generic error messages
   - Monitor error patterns

#### For Users

1. **Account Security**
   - Use strong, unique passwords
   - Enable two-factor authentication (2FA)
   - Review active sessions regularly
   - Report suspicious activity

2. **Data Protection**
   - Don't share credentials
   - Use secure connections (HTTPS)
   - Log out when finished
   - Review access permissions

## Security Updates

### Automated Updates

We use the following tools for automated security updates:

- **Dependabot**: Automated dependency updates
- **GitHub Security Advisories**: Vulnerability alerts
- **npm audit**: Regular security audits
- **CodeQL**: Static code analysis
- **Trivy**: Container and filesystem scanning

### Manual Updates

Security updates are released as soon as possible after a vulnerability is confirmed. Updates are announced via:

- GitHub Security Advisories
- Release notes
- Email notifications (for critical issues)
- Status page updates

## Compliance

ValueCanvas is designed to comply with:

- **OWASP Top 10**: Web application security risks
- **CWE Top 25**: Most dangerous software weaknesses
- **GDPR**: Data protection and privacy
- **SOC 2 Type II**: Security, availability, and confidentiality
- **NIST Cybersecurity Framework**: Security best practices

## Security Audits

### Internal Audits

- **Weekly**: Automated dependency scanning
- **Monthly**: Manual security review
- **Quarterly**: Comprehensive security audit

### External Audits

- **Annual**: Third-party security assessment
- **As Needed**: Penetration testing

## Bug Bounty Program

We currently do not have a public bug bounty program. However, we appreciate responsible disclosure and will acknowledge security researchers who help us improve our security.

### Recognition

Security researchers who responsibly disclose vulnerabilities will be:

- Acknowledged in our security advisories (with permission)
- Listed in our Hall of Fame (with permission)
- Eligible for swag and rewards (at our discretion)

## Contact

- **Security Team**: security@valuecanvas.com
- **Incident Response**: incidents@valuecanvas.com
- **General Inquiries**: support@valuecanvas.com

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)

---

**Last Updated**: November 18, 2025  
**Version**: 1.0.0

Thank you for helping keep ValueCanvas and our users safe!
