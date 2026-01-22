# Sentinel Journal

## 2026-01-22 - Missing Security Dependency in ValyntApp
**Vulnerability:** `apps/ValyntApp` contained a security utility `sanitizeHtml.ts` that imported `dompurify`, but `dompurify` was missing from `apps/ValyntApp/package.json`. This led to a situation where the utility might fail at runtime or tests fail, potentially bypassing sanitization if error handling was poor (though here it was a build/test time failure). Also, `BlogPost.tsx` was using `dangerouslySetInnerHTML` without this sanitizer.
**Learning:** Security utilities must have their dependencies explicitly declared in the same package to ensure reliability and correct resolution, rather than relying on workspace hoisting or implicit availability. Also, just having a sanitizer utility doesn't mean it's being used; manual inspection of `dangerouslySetInnerHTML` usage is crucial.
**Prevention:** Always verify that security-critical libraries (like `dompurify`) are listed in `dependencies`. Use tools to audit `dangerouslySetInnerHTML` usage and ensure they are wrapped with the sanitizer.
