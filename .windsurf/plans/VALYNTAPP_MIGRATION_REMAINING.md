# ValyntApp Migration - Remaining Tasks

Complete the ValyntApp migration by adding auth flow, common components, settings pages, billing, feature modules, services, and tests.

## Current Status

**Completed (Phases 1-7):**

- Root config files, public/, types/, lib/, app/config/, app/routes/, app/providers/
- services/http/, components/ui/, layouts/, pages/ (3 starter pages), hooks/

**Remaining:** 8 phases below

---

## Phase 8: Verify Build ⚡ P0

**Goal:** Confirm scaffold compiles and runs

```bash
cd ValyntApp && npm install && npm run dev
```

- [ ] Fix any TypeScript errors
- [ ] Verify dev server starts on localhost:5173
- [ ] Confirm landing page renders

---

## Phase 9: Common Components 🧩 P1

**Source:** `src/components/Common/` → **Target:** `src/components/common/`

| File                  | Priority |
| --------------------- | -------- |
| LoadingSpinner.tsx    | High     |
| Spinner.tsx           | High     |
| EmptyState.tsx        | High     |
| Toast.tsx             | High     |
| ErrorBoundary.tsx     | High     |
| ConfirmationModal.tsx | Medium   |
| Tooltip.tsx           | Medium   |

---

## Phase 10: Auth Flow 🔐 P1

**Critical path for SaaS**

### Pages (`src/views/Auth/` → `src/pages/auth/`)

| File                                  | Notes          |
| ------------------------------------- | -------------- |
| ModernLoginPage.tsx → LoginPage.tsx   | Preferred      |
| ModernSignupPage.tsx → SignupPage.tsx | Preferred      |
| ResetPasswordPage.tsx                 |                |
| AuthCallback.tsx                      | OAuth callback |

### Components (`src/components/Auth/` → `src/components/app/`)

- ProtectedRoute.tsx
- SessionExpiredModal.tsx
- SessionExpiryWarning.tsx

### Services

- Migrate/adapt AuthService.ts for Supabase integration
- Update AuthProvider to use real Supabase auth

---

## Phase 11: App Bootstrap 🚀 P2

**Source:** `src/bootstrap.ts` → **Target:** `src/app/bootstrap/init.ts`

- [ ] Environment validation
- [ ] Analytics initialization
- [ ] Feature flags setup
- [ ] Error monitoring (Sentry optional)

---

## Phase 12: Settings Pages ⚙️ P3

**Source:** `src/views/Settings/` → **Target:** `src/pages/app/`

| File                                | Priority |
| ----------------------------------- | -------- |
| SettingsView.tsx → SettingsPage.tsx | High     |
| UserProfile.tsx                     | High     |
| UserSecurity.tsx                    | Medium   |
| UserAppearance.tsx                  | Medium   |
| UserNotifications.tsx               | Low      |

---

## Phase 13: Billing (Optional) 💳 P4

**Only if `VITE_BILLING_ENABLED=true`**

**Source:** `src/components/Billing/` + `src/views/Settings/`

| File                 | Target                    |
| -------------------- | ------------------------- |
| BillingDashboard.tsx | pages/app/BillingPage.tsx |
| PlanSelector.tsx     | components/app/           |
| UsageMetrics.tsx     | components/app/           |
| InvoiceList.tsx      | components/app/           |

---

## Phase 14: Feature Modules 📦 P5

**Source:** `src/features/` → **Target:** `src/features/`

```
features/
├── auth/
│   ├── api.ts
│   ├── hooks.ts
│   ├── types.ts
│   └── components/
├── billing/
│   ├── api.ts
│   ├── types.ts
│   └── components/
└── workspace/
    └── ...
```

---

## Phase 15: Additional Services 🔌 P6

**Source:** `src/services/` → **Target:** `src/services/`

| Service         | Priority                                           |
| --------------- | -------------------------------------------------- |
| analytics/      | Medium                                             |
| storage/        | Medium                                             |
| supabase client | High (if not using @supabase/supabase-js directly) |

---

## Phase 16: Tests Setup 🧪 P7

**Target:** `src/tests/`

- [ ] tests/setup.ts - Vitest configuration
- [ ] tests/factories/ - Test data factories
- [ ] Example component test
- [ ] Example hook test

---

## Execution Order

1. **Phase 8** - Verify build works
2. **Phase 9** - Common components (unblocks all UI)
3. **Phase 10** - Auth flow (unblocks protected routes)
4. **Phase 11** - Bootstrap (proper initialization)
5. **Phase 12** - Settings pages
6. **Phase 13** - Billing (if needed)
7. **Phase 14-16** - Feature modules, services, tests

---

## Notes

- Each phase is designed to be completable in 1-2 sessions
- Verify the app runs after each phase
- Skip Phase 13 (Billing) if not needed initially
- Clean versions preferred over direct copies where dependencies are heavy
