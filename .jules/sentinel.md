## 2025-02-18 - Reverse Tabnabbing Vulnerability
**Vulnerability:** Links with target="_blank" were missing rel="noopener noreferrer", allowing opened pages to access window.opener (Reverse Tabnabbing).
**Learning:** Even when using sanitization libraries like DOMPurify, default configurations might not enforce all security headers/attributes automatically. Hooks are powerful for this.
**Prevention:** Use DOMPurify hooks (afterSanitizeAttributes) to programmatically enforce security attributes on all user content.
