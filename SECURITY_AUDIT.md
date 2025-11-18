# Security Audit Report

## Executive Summary
- Exposed API keys in frontend code risk full compromise of LLM billing and downstream systems if the keys are abused.
- Multiple client-side rendering paths trust unsanitized HTML, exposing users to stored and reflected Cross-Site Scripting (XSS).
- Security controls such as rate limiting and Supabase access rely on client-side enforcement, leaving authentication and data-integrity controls bypassable.

## Findings

### 1) LLM API keys shipped to the browser (Critical)
- **Location:** `src/services/AgentFabricService.ts` retrieves `VITE_OPENAI_API_KEY`/`VITE_TOGETHER_API_KEY` and passes them directly to the client runtime.
- **Impact:** Any user can extract the keys from the bundle or DevTools and issue arbitrary API calls, incurring cost and bypassing usage policies. This violates secret-management best practices (OWASP ASVS 2.10) and aligns with CWE-798 (Use of Hard-coded Credentials).
- **Recommendation:** Move all LLM invocations server-side behind authenticated endpoints. Inject keys only on the server, never in Vite browser builds. If client access is unavoidable, proxy requests through a backend that performs authorization, rate limiting, and audit logging.

### 2) Unsanitized HTML rendering enables XSS (High)
- **Locations:**
  - `src/views/DocumentationView.tsx` (line 290) renders `currentPage.content` from the database with `dangerouslySetInnerHTML`.
  - `src/components/Components/NarrativeBlock.tsx` renders editable `content` via `dangerouslySetInnerHTML` with only minimal Markdown replacement.
- **Impact:** Any stored page content or user-editable narrative text containing `<script>` or event handlers executes in other users' browsers (OWASP A03:2021 Injection / CWE-79 Stored XSS).
- **Recommendation:** Sanitize HTML before rendering (e.g., `DOMPurify.sanitize`) or avoid `dangerouslySetInnerHTML`. Treat user/LLM-generated content as untrusted and enforce an allowlist of safe tags.

### 3) Client-side-only login rate limiting (Medium)
- **Location:** `src/services/AuthService.ts` enforces login throttling with an in-memory `RateLimiter` in the browser.
- **Impact:** Attackers can bypass limits by clearing state, rotating devices, or calling the authentication API directly, enabling credential-stuffing and brute-force attempts (OWASP A07:2021 Identification and Authentication Failures / CWE-307).
- **Recommendation:** Implement server-side rate limiting at the API gateway/edge (e.g., Supabase Edge Functions, reverse proxy, or WAF). Keep the client-side limiter only as a UX hint.

### 4) Supabase writes executed with anonymous client context (Medium)
- **Location:** `src/lib/agent-fabric/AgentFabric.ts` performs inserts/updates to workflow tables using the public Supabase client and defaults the user to `anonymous-user` when no ID is provided.
- **Impact:** Without strict RLS policies, any anonymous browser session can create or mutate workflow, company profile, and value map records, risking data poisoning or unauthorized data access (OWASP A01:2021 Broken Access Control / CWE-284). The client cannot enforce trust boundaries.
- **Recommendation:** Enforce RLS on all affected tables and require authenticated user context. Move write-heavy workflow orchestration to authenticated server-side functions or edge functions that verify user/session claims. Reject requests without a validated user ID rather than silently using an anonymous placeholder.

## Remediation Roadmap (Priority Order)
1. **Secrets handling:** Remove API keys from client bundles; route LLM calls through authenticated server/edge services with monitoring.
2. **Output sanitization:** Introduce centralized HTML sanitization for documentation and narrative rendering; add Content Security Policy (CSP) where feasible.
3. **Server-side controls:** Add server-enforced rate limiting and authentication checks for Supabase interactions; ensure RLS covers all workflow tables.
4. **Defense-in-depth:** Expand security logging for auth failures and workflow mutations; add automated tests to prevent regression of these controls.

## Suggested Fix Patterns
- **Sanitize before render (React):**
  ```tsx
  import DOMPurify from 'dompurify';

  const safeHtml = DOMPurify.sanitize(untrustedHtml, { USE_PROFILES: { html: true } });
  return <div dangerouslySetInnerHTML={{ __html: safeHtml }} />;
  ```
- **Server-side LLM proxy (Express-style example):**
  ```ts
  // POST /api/llm
  router.post('/llm', authenticate, rateLimit, async (req, res) => {
    const prompt = validatePrompt(req.body.prompt);
    const llmResponse = await llmClient.generate({ prompt });
    res.json({ result: llmResponse });
  });
  ```
- **Require authenticated Supabase context:**
  ```ts
  const { data, error } = await supabase
    .from('workflow_executions')
    .insert({ ...payload, user_id: session.user.id });
  if (error) throw error;
  ```
