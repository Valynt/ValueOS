import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { MarketingLayout } from "@layouts/MarketingLayout";
import { AppLayout } from "@layouts/AppLayout";
import { ProtectedRoute } from "./route-guards";

const LandingPage = lazy(() => import("@pages/marketing/LandingPage"));
const DashboardPage = lazy(() => import("@pages/app/DashboardPage"));
const ChatCanvasLayout = lazy(() => import("@components/ChatCanvas/ChatCanvasLayout"));
const NotFoundPage = lazy(() => import("@pages/errors/NotFoundPage"));
const LoginPage = lazy(() => import("@pages/auth/LoginPage"));
const SignupPage = lazy(() => import("@pages/auth/SignupPage"));
const ResetPasswordPage = lazy(() => import("@pages/auth/ResetPasswordPage"));

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

// Billing
const BillingPage = lazy(() => import("@pages/billing/BillingPage"));

// Admin
const AdminDashboard = lazy(() => import("@pages/admin/AdminDashboard"));
const UsersPage = lazy(() => import("@pages/admin/UsersPage"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
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

          {/* Workspace - ChatCanvas UI (unprotected for dev) */}
          <Route path="/workspace" element={<ChatCanvasLayout />} />

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

            {/* Settings routes */}
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<ProfilePage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="appearance" element={<AppearancePage />} />
            </Route>

            {/* Billing */}
            <Route path="/billing" element={<BillingPage />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UsersPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
