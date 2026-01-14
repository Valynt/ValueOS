# 🐛 Fixed: 'speakeasy' Default Export Error

**Date**: 2026-01-08 08:58 UTC
**Status**: ✅ **Resolved**

## 🚨 The Error

```
MFAService.ts:16 Uncaught SyntaxError: The requested module '/@fs/.../speakeasy/index.js'
does not provide an export named 'default'
```

## 🔍 The Cause

- `speakeasy` is a **CommonJS** library that uses named exports (`exports.generateSecret = ...`).
- It does **not** have a `module.exports = ...` assignment that corresponds to a default export.
- `import * as speakeasy` caused confusion in the Vite/Rollup interop layer, leading it to look for a `default` export that didn't exist.

## 🛠️ The Fix

Refactored `src/services/MFAService.ts` to use **Named Imports**:

```typescript
// ❌ Before (Caused Error)
import * as speakeasy from "speakeasy";
import * as QRCode from "qrcode";

// ✅ After (Fixed)
import { generateSecret, totp } from "speakeasy";
import { toDataURL } from "qrcode";
```

## 🔄 Action Taken

1.  Edited `MFAService.ts` to use named imports.
2.  **Restarted Vite Server** to clear the module graph cache.

## ✅ Verification

Refresh `http://localhost:5173/login`. The error should be gone.
