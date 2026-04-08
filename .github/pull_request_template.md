## Description
<!-- Provide a brief description of the changes in this PR -->

## Type of Change
<!-- Mark the relevant option with an [x] -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 UI/UX improvement
- [ ] ♻️ Code refactoring
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix
- [ ] 🗄️ Database migration

## Related Issues
<!-- Link to related issues/tickets -->
Closes #

## Changes Made
<!-- List the specific changes made in this PR -->

- 
- 
- 

## Testing Completed
<!-- Describe the testing you've done -->

### Unit Tests
- [ ] Added new unit tests
- [ ] Updated existing unit tests
- [ ] All unit tests passing

### Integration Tests
- [ ] Added integration tests
- [ ] All integration tests passing

### Manual Testing
- [ ] Tested in local environment
- [ ] Tested in preview environment
- [ ] Verified on multiple browsers (if UI change)
- [ ] Verified on mobile (if UI change)

### Test Coverage
- [ ] Coverage meets minimum threshold (80%)
- [ ] Critical paths have 100% coverage

## Database Changes
<!-- If this PR includes database changes -->

- [ ] Migration scripts added
- [ ] Rollback scripts included
- [ ] Tested migration locally
- [ ] Verified data integrity
- [ ] No breaking changes to existing data

## Security Considerations
<!-- Address any security implications -->

- [ ] No sensitive data exposed
- [ ] Input validation added where necessary
- [ ] Authentication/authorization properly implemented
- [ ] Security scan passed
- [ ] OWASP Top 10 considered

## Performance Impact
<!-- Describe any performance implications -->

- [ ] No performance regression
- [ ] Performance improvement quantified
- [ ] Load testing completed (if applicable)
- [ ] Database queries optimized

## Deployment Notes
<!-- Special instructions for deployment -->

**Prerequisites:**
<!-- List any prerequisites like environment variables, migrations, etc. -->

**Deployment Steps:**
<!-- Any special deployment steps required -->

**Rollback Plan:**
<!-- How to rollback if this causes issues -->

**Monitoring:**
<!-- What metrics/logs to monitor after deployment -->

## Screenshots/Recordings
<!-- If applicable, add screenshots or recordings of UI changes -->

## Localization Onboarding Evidence (required when user-facing copy changes)
- [ ] Coverage diff attached (before/after or CI artifact excerpt from `artifacts/i18n/coverage-dashboard.json`)
- [ ] Pseudo-localization evidence attached (`en-XA` screenshot(s) and/or run logs from `artifacts/i18n/pseudo-localization-report.json`)
- [ ] If adding a newly declared locale: locale readiness status updated (`supported` / `in-progress` / `blocked`) in `docs/quality/ux-quality-scorecard.md`

## Checklist
<!-- Ensure all items are completed before requesting review -->

### Code Quality
- [ ] Strict-zone TODO/FIXME comments (if any) include metadata: `TODO(ticket:<id> owner:<team|user> date:YYYY-MM-DD)`
- [ ] Code follows project coding standards
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] No console.log or debugging code left
- [ ] TypeScript types properly defined
- [ ] ESLint passing with no warnings
- [ ] Prettier formatting applied

### Documentation
- [ ] README updated (if needed)
- [ ] API documentation updated (if needed)
- [ ] Code comments added where necessary
- [ ] CHANGELOG updated (if applicable)
- [ ] Observability contract updated for telemetry/config changes (`infra/observability/README.md`)

### Dependencies
- [ ] No unnecessary dependencies added
- [ ] Security vulnerabilities checked (`npm audit`)
- [ ] License compliance verified

### Accessibility
- [ ] WCAG 2.1 AA compliance (if UI change)
- [ ] Keyboard navigation tested
- [ ] Screen reader tested
- [ ] Color contrast verified

### Error Handling
- [ ] Error cases handled gracefully
- [ ] User-friendly error messages
- [ ] Errors logged appropriately
- [ ] No silent failures

## Reviewer Notes
<!-- Any specific areas you want reviewers to focus on -->

## Post-Merge Actions
<!-- Actions to take after merge -->

- [ ] Monitor error rates in production
- [ ] Verify analytics/metrics
- [ ] Update tracking tickets
- [ ] Notify stakeholders
