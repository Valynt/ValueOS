## 2025-02-18 - Reverse Tabnabbing Vulnerability
**Vulnerability:** Links with target="_blank" were missing rel="noopener noreferrer", allowing opened pages to access window.opener (Reverse Tabnabbing).
**Learning:** Even when using sanitization libraries like DOMPurify, default configurations might not enforce all security headers/attributes automatically. Hooks are powerful for this.
**Prevention:** Use DOMPurify hooks (afterSanitizeAttributes) to programmatically enforce security attributes on all user content.
## 2025-02-18 - API Error Handling Security
**Vulnerability:** Direct usage of `console.error` and returning raw error messages in API responses can leak PII and sensitive internal details.
**Learning:** Always use the centralized logger with PII sanitization. Error responses should be generic in production and only verbose in development.
**Prevention:** Refactor legacy endpoints to use `src/lib/logger` and implement environment-aware error message masking.
