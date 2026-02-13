---
description: Systematic approach to debugging issues in ValueOS
---

# Debugging Workflow

1. **Reproduce the Issue**
   - Identify the exact steps to reproduce
   - Note any error messages or unexpected behavior

2. **Check Logs**
   - Check browser console for frontend errors
   - Check `backend.log` or terminal output for backend errors
   - Review Supabase logs if database-related

3. **Identify the Component**
   - Use grep_search to find related code
   - Check the component's test files for expected behavior

4. **Run Related Tests**
   - Run the specific test file: `npx vitest run <test-file> --passWithNoTests`
   - Check if tests pass or reveal the issue

5. **Fix and Verify**
   - Make the fix
   - Run tests again to verify
   - Test manually in the browser

6. **Document** (if significant)
   - Update relevant documentation if the fix reveals a non-obvious behavior
