---
name: code-review
description: Provides a checklist and style guide for reviewing code before merging
---

# Code Review

This skill provides a comprehensive checklist and style guide for conducting thorough code reviews before merging pull requests.

## When to Run

Run this skill when:
- Reviewing a pull request before merge
- Conducting peer code reviews
- Validating code quality for releases
- Auditing code for security or performance issues

## Code Review Principles

### 1. Respect and Collaboration
- Focus on code quality, not personal criticism
- Assume good intent from the author
- Provide actionable feedback with explanations
- Balance being thorough with being efficient

### 2. Quality Standards
- Code must be correct, maintainable, and efficient
- Changes should align with project architecture
- Tests should be comprehensive and passing
- Documentation should be clear and complete

### 3. Risk Assessment
- Consider impact on production systems
- Evaluate security implications
- Assess performance and scalability
- Review for backward compatibility

## Pre-Review Preparation

### Understand the Context
- [ ] Read the pull request description thoroughly
- [ ] Understand the problem being solved
- [ ] Review related issues or user stories
- [ ] Check if this is part of a larger feature

### Environment Setup
- [ ] Pull the branch locally
- [ ] Run the application to understand changes
- [ ] Execute relevant tests
- [ ] Check for any environment-specific considerations

## Code Review Checklist

### Functionality & Logic

#### Core Requirements
- [ ] Code solves the stated problem correctly
- [ ] Business logic is sound and complete
- [ ] Edge cases are handled appropriately
- [ ] Error conditions are managed gracefully
- [ ] User input validation is comprehensive

#### Algorithm & Performance
- [ ] Algorithms are efficient and appropriate
- [ ] No obvious performance bottlenecks
- [ ] Database queries are optimized
- [ ] Memory usage is reasonable
- [ ] Scalability considerations addressed

### Code Quality & Standards

#### Readability & Maintainability
- [ ] Code is self-documenting with clear naming
- [ ] Functions/methods have single responsibilities
- [ ] Code follows established patterns
- [ ] Comments explain complex logic, not obvious code
- [ ] No hardcoded values or magic numbers

#### Structure & Organization
- [ ] Files are appropriately organized
- [ ] Classes/modules have clear boundaries
- [ ] Dependencies are minimal and clear
- [ ] Code follows project conventions
- [ ] No unnecessary duplication

### Testing & Verification

#### Test Coverage
- [ ] Unit tests cover all new functionality
- [ ] Edge cases and error paths tested
- [ ] Integration tests validate system interactions
- [ ] Existing tests still pass
- [ ] Test names are descriptive

#### Test Quality
- [ ] Tests are isolated and independent
- [ ] Mock usage is appropriate (not over-mocked)
- [ ] Tests verify behavior, not implementation
- [ ] Performance and load tests included where relevant

### Security Considerations

#### Input Validation
- [ ] All user inputs are validated and sanitized
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention in web components
- [ ] CSRF protection for state-changing operations

#### Authentication & Authorization
- [ ] Proper authentication checks in place
- [ ] Authorization rules correctly implemented
- [ ] Session management is secure
- [ ] Password handling follows security standards

#### Data Protection
- [ ] Sensitive data is encrypted at rest
- [ ] Secure communication protocols used
- [ ] No sensitive data logged inappropriately
- [ ] GDPR/privacy compliance maintained

### Documentation & Communication

#### Code Documentation
- [ ] Public APIs are documented
- [ ] Complex algorithms have explanatory comments
- [ ] Breaking changes documented
- [ ] Migration guides provided if needed

#### PR Documentation
- [ ] Pull request description is clear and complete
- [ ] Screenshots/videos included for UI changes
- [ ] Breaking changes clearly marked
- [ ] Testing instructions provided

## Review Process

### 1. Automated Checks First
- [ ] Linting passes without errors
- [ ] Tests pass in CI/CD pipeline
- [ ] Security scans complete without critical issues
- [ ] Code coverage meets minimum requirements

### 2. Manual Review Steps
- [ ] Review code changes file by file
- [ ] Test functionality locally
- [ ] Check for security vulnerabilities
- [ ] Validate performance implications
- [ ] Review related documentation

### 3. Author Response
- [ ] Address all review comments
- [ ] Explain decisions where reviewer disagrees
- [ ] Provide additional tests if requested
- [ ] Update documentation as needed

### 4. Final Approval
- [ ] All blocking issues resolved
- [ ] Tests pass and coverage maintained
- [ ] Documentation updated
- [ ] No outstanding security concerns

## Common Issues to Flag

### Critical Issues (Block Merge)
- Security vulnerabilities
- Data corruption potential
- Breaking API changes without migration
- Performance degradation >20%
- Test coverage <80%

### Major Issues (Require Discussion)
- Significant architectural changes
- Complex algorithms without explanation
- Unusual dependency additions
- Database schema changes with migration risks

### Minor Issues (Suggestions)
- Code style inconsistencies
- Opportunities for refactoring
- Additional test coverage suggestions
- Documentation improvements

## Review Time Guidelines

### By Change Size
- **Small (1-2 files, <50 lines)**: 15-30 minutes
- **Medium (3-5 files, 50-200 lines)**: 30-60 minutes
- **Large (6+ files, 200+ lines)**: 60-120 minutes
- **Complex (architecture changes)**: 120+ minutes

### Review Focus Areas
- **Functionality**: Does it work correctly?
- **Security**: Are there vulnerabilities?
- **Performance**: Any bottlenecks introduced?
- **Maintainability**: Easy to understand and modify?
- **Testing**: Sufficient coverage and quality?

## Communication Guidelines

### Constructive Feedback
```markdown
❌ "This code is terrible"
✅ "This logic could be simplified by using the existing helper function in utils.js"
```

### Actionable Requests
```markdown
❌ "Add error handling"
✅ "Please add error handling for the case where the API returns a 500 status"
```

### Positive Reinforcement
- Acknowledge good practices
- Highlight well-written code
- Recognize thorough testing
- Appreciate clear documentation

## Review Automation

### Recommended Tools
- ESLint/Prettier for code style
- SonarQube for code quality metrics
- Snyk/OWASP for security scanning
- Codecov for coverage reporting
- Dependabot for dependency updates

### Custom Review Scripts
```bash
# Pre-review checklist script
./scripts/pre-review-checklist.sh

# Automated style and quality checks
./scripts/code-quality-gate.sh

# Security vulnerability scan
./scripts/security-scan.sh
```

## Follow-up Actions

### Post-Merge Validation
- Monitor production metrics for 24 hours
- Check error rates and performance
- Validate user-reported issues resolved
- Update documentation if needed

### Continuous Improvement
- Document lessons learned from reviews
- Update review guidelines based on findings
- Train team on common issues
- Refine automated checks based on manual findings
