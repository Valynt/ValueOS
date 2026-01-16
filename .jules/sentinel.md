## 2024-05-21 - [PostgREST Injection Vulnerability]
**Vulnerability:** Found unvalidated user input being interpolated into Supabase PostgREST `.or()` filter strings in `AgentMemoryService.ts` and `DocumentationCMS.tsx`. This allows attackers to inject arbitrary filter conditions.
**Learning:** Supabase's `.or()` method accepts a raw string where delimiters like `,` are significant. Interpolating user input directly into this string without sanitization is a security risk similar to SQL injection.
**Prevention:** Always sanitize input used in `.or()` filters by removing or escaping PostgREST reserved characters (`,`, `.`, `(`, `)`, `:`).
