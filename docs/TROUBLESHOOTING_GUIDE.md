# ValueCanvas Troubleshooting Guide

**Last Updated:** December 5, 2025

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Performance Issues](#performance-issues)
4. [Integration Issues](#integration-issues)
5. [Debugging Tools](#debugging-tools)

---

## Quick Diagnostics

### Health Check Commands

```bash
# Check application status
curl https://app.valuecanvas.com/health

# Check Supabase connection
supabase status

# Verify environment variables
npm run check-env

# Run test suite
npm test

# Check TypeScript compilation
npm run typecheck
```

---

## Common Issues

### Issue: "Cannot connect to Supabase"

**Symptoms:**
- Network errors in console
- 401 Unauthorized errors
- Data not loading

**Solutions:**

1. **Verify environment variables**
   ```bash
   echo $VITE_SUPABASE_URL
   echo $VITE_SUPABASE_ANON_KEY
   ```

2. **Check Supabase project status**
   - Visit Supabase dashboard
   - Verify project is not paused
   - Check for service outages

3. **Verify CORS settings**
   - Supabase Dashboard > Settings > API
   - Ensure your domain is whitelisted

4. **Check RLS policies**
   ```sql
   -- Verify policies exist
   SELECT * FROM pg_policies WHERE tablename = 'value_cases';
   ```

---

### Issue: "Agent not responding"

**Symptoms:**
- Spinner shows indefinitely
- No SDUI output generated
- Timeout errors

**Solutions:**

1. **Check Together.ai API status**
   ```bash
   curl -H "Authorization: Bearer $TOGETHER_API_KEY" \
     https://api.together.xyz/v1/models
   ```

2. **Verify API key is valid**
   - Check `.env` file
   - Ensure no extra spaces/newlines

3. **Review rate limits**
   - Check Together.ai dashboard for usage
   - Implement backoff strategy

4. **Check logs**
   ```typescript
   // Enable debug logging
   localStorage.setItem('DEBUG', 'agent:*');
   ```

---

### Issue: "SDUI components not rendering"

**Symptoms:**
- Blank canvas
- "Component not found" errors
- Fallback UI showing

**Solutions:**

1. **Check component registry**
   ```typescript
   import { componentRegistry } from './sdui/ComponentToolRegistry';
   console.log(Array.from(componentRegistry.keys()));
   ```

2. **Verify SDUI schema validation**
   ```typescript
   import { validatePageForRendering } from './sdui/engine/renderPage';
   const result = validatePageForRendering(page);
   console.log(result.errors);
   ```

3. **Check for sanitization issues**
   ```typescript
   import { sduiSanitizer } from './lib/security/SDUISanitizer';
   const result = sduiSanitizer.sanitizePage(page);
   console.log(result.violations);
   ```

---

### Issue: "Authentication loop / Stuck on login"

**Symptoms:**
- Redirects back to login after successful auth
- Session not persisting
- "Invalid JWT" errors

**Solutions:**

1. **Clear local storage**
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Check cookie settings**
   - Ensure `SameSite=None; Secure` for cross-domain
   - Verify domain matches Supabase config

3. **Verify JWT expiration**
   ```typescript
   const { data } = await supabase.auth.getSession();
   console.log(data.session?.expires_at);
   ```

4. **Check redirect URLs**
   - Supabase Dashboard > Authentication > URL Configuration
   - Verify redirect URLs include your domain

---

## Performance Issues

### Issue: "Slow page load times"

**Diagnostics:**

```bash
# Build analysis
npm run build -- --analyze

# Lighthouse audit
npm run lighthouse

# Bundle size check
npm run analyze-bundle
```

**Solutions:**

1. **Code splitting**
   - Implement React.lazy for routes
   - Split vendor bundles

2. **Image optimization**
   - Convert to WebP
   - Implement lazy loading
   - Use appropriate sizing

3. **Reduce bundle size**
   ```bash
   # Find large dependencies
   npx source-map-explorer dist/*.js
   ```

---

### Issue: "High LLM API latency"

**Symptoms:**
- Agent responses > 10s
- Frequent timeouts
- Poor user experience

**Solutions:**

1. **Implement streaming**
   ```typescript
   // Use streaming responses
   const stream = await agent.chatStream(input);
   ```

2. **Optimize prompts**
   - Reduce prompt length
   - Remove unnecessary context
   - Use prompt caching

3. **Monitor token usage**
   ```typescript
   console.log(`Tokens used: ${response.usage.total_tokens}`);
   ```

---

### Issue: "Database queries slow"

**Diagnostics:**

```sql
-- Find slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Solutions:**

1. **Add indexes**
   ```sql
   CREATE INDEX CONCURRENTLY idx_value_cases_user_id_status 
   ON value_cases(user_id, status);
   ```

2. **Optimize queries**
   - Use `.select()` to limit columns
   - Implement pagination
   - Avoid N+1 queries

3. **Enable query caching**
   ```typescript
   const { data } = await supabase
     .from('value_cases')
     .select('*')
     .eq('user_id', userId)
     .cache(300); // 5 minutes
   ```

---

## Integration Issues

### Issue: "CRM import failing"

**Symptoms:**
- Import button not working
- Data mapping errors
- Partial imports

**Solutions:**

1. **Verify CRM credentials**
   - Check OAuth tokens
   - Refresh expired tokens

2. **Check field mapping**
   ```typescript
   import { validateCRMMapping } from './services/CRMFieldMapper';
   const errors = validateCRMMapping(mapping);
   ```

3. **Review API rate limits**
   - Salesforce: 15,000/day
   - HubSpot: Varies by tier

---

### Issue: "Email analysis not working"

**Solutions:**

1. **Check email format**
   - Ensure plain text or HTML
   - Verify encoding (UTF-8)

2. **Review content length**
   - Max 10,000 characters
   - Split long threads

---

## Debugging Tools

### Enable Debug Mode

```typescript
// In browser console
localStorage.setItem('DEBUG', '*');
localStorage.setItem('SDUI_DEBUG', 'true');

// Reload page to see debug output
```

### React DevTools

1. Install React DevTools extension
2. Open Components tab
3. Inspect Canvas Store state

### Network Debugging

```javascript
// Log all Supabase requests
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, session);
});
```

### Sentry Debugging

```typescript
import * as Sentry from '@sentry/react';

// Add breadcrumbs
Sentry.addBreadcrumb({
  category: 'agent',
  message: 'Agent chat initiated',
  level: 'info',
});

// Capture context
Sentry.setContext('agent', {
  agentId: 'opportunity-v1',
  query: userQuery,
});
```

---

## Error Codes Reference

| Code | Meaning | Solution |
|------|---------|----------|
| `AUTH_001` | Invalid credentials | Check email/password |
| `AUTH_002` | Session expired | Re-authenticate |
| `AGENT_001` | LLM API timeout | Retry request |
| `AGENT_002` | Rate limit exceeded | Wait or upgrade plan |
| `SDUI_001` | Invalid schema | Check SDUI structure |
| `SDUI_002` | Component not found | Register component |
| `DB_001` | Connection failed | Check Supabase status |
| `DB_002` | Query timeout | Optimize query |

---

## Getting Help

### Self-Service

1. Check this troubleshooting guide
2. Review [Architecture Overview](./ARCHITECTURE_OVERVIEW.md)
3. Search GitHub issues
4. Check Supabase/Together.ai status pages

### Support Channels

- **Slack:** #valuecanvas-support
- **Email:** support@valuecanvas.app
- **GitHub Issues:** https://github.com/your-org/valuecanvas/issues

### Reporting Bugs

Include:
1. Error message (full stack trace)
2. Steps to reproduce
3. Environment (browser, OS, version)
4. Network logs (if applicable)
5. Sentry event ID (if applicable)

---

**Maintained by:** ValueCanvas Support Team  
**Last Review:** December 5, 2025
