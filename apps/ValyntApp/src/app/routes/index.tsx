import { AppLayout } from "@layouts/AppLayout";
import { MarketingLayout } from "@layouts/MarketingLayout";
import { LoadingSkeleton } from "@valueos/components/ui/loading-skeleton";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { PermissionRoute, ProtectedRoute } from "./route-guards";
import { PERMISSIONS } from "../../lib/permissions";


const LandingPage = lazy(() => import("@pages/marketing/LandingPage"));
const DashboardPage = lazy(() => import("@pages/app/DashboardPage"));
const ChatCanvasLayout = lazy(() => import("@components/chat-canvas/ChatCanvasLayout"));
const NotFoundPage = lazy(() => import("@pages/errors/NotFoundPage"));

// ValueOS pages
const AppShell = lazy(() => import("@components/layout/AppShell"));
const ValueOSHome = lazy(() => import("@pages/valueos/HomePage"));
const ValueOSCases = lazy(() => import("@pages/valueos/CasesPage"));
const ValueOSCaseWorkspace = lazy(() => import("@pages/valueos/CaseWorkspace"));
const ValueOSTeam = lazy(() => import("@pages/valueos/TeamPage"));
const ValueOSBilling = lazy(() => import("@pages/valueos/BillingPage"));
const LoginPage = lazy(() => import("@pages/auth/LoginPage"));
const SignupPage = lazy(() => import("@pages/auth/SignupPage"));
const ResetPasswordPage = lazy(() => import("@pages/auth/ResetPasswordPage"));
const SetupPage = lazy(() => import("@pages/auth/SetupPage"));

// Academy pages
const AcademyHome = lazy(() => import("@features/academy/pages/AcademyHome"));
const AcademyDashboard = lazy(() => import("@features/academy/pages/AcademyDashboard"));
const AcademyQuiz = lazy(() => import("@features/academy/pages/AcademyQuiz"));
const AcademyAITutor = lazy(() => import("@features/academy/pages/AcademyAITutor"));

// Settings pages
const SettingsLayout = lazy(() => import("@pages/settings/SettingsLayout"));
const ProfilePage = lazy(() => import("@pages/settings/ProfilePage"));
const SecurityPage = lazy(() => import("@pages/settings/SecurityPage"));
const NotificationsPage = lazy(() => import("@pages/settings/NotificationsPage"));
const AppearancePage = lazy(() => import("@pages/settings/AppearancePage"));
const TeamSettings = lazy(() => import("@pages/settings/TeamSettings"));
const BillingSettings = lazy(() => import("@pages/settings/BillingSettings"));
const IntegrationsPage = lazy(() => import("@pages/settings/IntegrationsPage"));
const BrandingPage = lazy(() => import("@pages/settings/BrandingPage"));

// Billing
const BillingPage = lazy(() => import("@pages/billing/BillingPage"));

// Admin
const AdminDashboard = lazy(() => import("@pages/admin/AdminDashboard"));
const UsersPage = lazy(() => import("@pages/admin/UsersPage"));
const SecurityDashboard = lazy(() => import("@pages/admin/SecurityDashboard"));

// Guest
const GuestAccessPage = lazy(() => import("@pages/guest/GuestAccessPage"));

// Library
const LibraryPage = lazy(() => import("@pages/valueos/LibraryPage"));
const TemplatesPage = lazy(() => import("@pages/valueos/TemplatesPage"));
const ValueDriverLibrary = lazy(() => import("@pages/valueos/ValueDriverLibrary"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSkeleton variant="text" lines={1} className="w-24" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Marketing routes */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>

          {/* Auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/setup" element={<SetupPage />} />

          {/* Guest access (public) */}
          <Route path="/guest/access" element={<GuestAccessPage />} />

          {/* Workspace - ChatCanvas UI (unprotected for dev) */}
          <Route path="/workspace" element={<ChatCanvasLayout />} />

          {/* ValueOS App (unprotected for dev) */}
          <Route path="/app" element={<AppShell />}>
            <Route index element={<ValueOSHome />} />
            <Route path="cases" element={<ValueOSCases />} />
            <Route path="cases/new" element={<ValueOSCaseWorkspace />} />
            <Route path="cases/:caseId" element={<ValueOSCaseWorkspace />} />
            <Route path="library" element={<LibraryPage />}>
              <Route index element={<TemplatesPage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="drivers" element={<ValueDriverLibrary />} />
            </Route>
            <Route path="team" element={<ValueOSTeam />} />
            <Route path="billing" element={<ValueOSBilling />} />

            {/* Settings within app shell */}
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<ProfilePage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="billing" element={<BillingSettings />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="team" element={<TeamSettings />} />
              <Route path="branding" element={<BrandingPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
            </Route>
            <Route path="settings" element={<ValueOSHome />} />
          </Route>

          {/* App routes (protected) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>

            {/* Academy routes */}
            <Route path="/academy" element={<AcademyHome />} />
            <Route path="/academy/dashboard" element={<AcademyDashboard />} />
            <Route path="/academy/quiz/:pillarNumber" element={<AcademyQuiz />} />
            <Route path="/academy/ai-tutor" element={<AcademyAITutor />} />

            {/* Settings routes - standalone (for direct access) */}
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<ProfilePage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="billing" element={<BillingSettings />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="team" element={<TeamSettings />} />
              <Route path="branding" element={<BrandingPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
            </Route>

            {/* Billing */}
            <Route path="/billing" element={<BillingPage />} />

            {/* Admin */}
            <Route element={<PermissionRoute requiredPermissions={[PERMISSIONS.ADMIN_ACCESS]} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/security" element={<SecurityDashboard />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
