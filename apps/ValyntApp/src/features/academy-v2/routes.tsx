/**
 * Academy v2 Routes
 * React Router routes for the migrated VOSAcademy feature
 */
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

// Lazy load academy pages
const AcademyDashboard = lazy(() => import("./pages/Dashboard"));
const AcademyHome = lazy(() => import("./pages/Home"));
const PillarOverview = lazy(() => import("./pages/PillarOverview"));
const Quiz = lazy(() => import("./pages/Quiz"));
const AITutor = lazy(() => import("./pages/AITutor"));
const Profile = lazy(() => import("./pages/Profile"));
const Resources = lazy(() => import("./pages/Resources"));
const Certifications = lazy(() => import("./pages/Certifications"));
const Simulations = lazy(() => import("./pages/Simulations"));
const SimulationProgress = lazy(() => import("./pages/SimulationProgress"));
const Analytics = lazy(() => import("./pages/Analytics"));
const ValueTreeBuilder = lazy(() => import("./pages/ValueTreeBuilder"));
const MaturityAssessment = lazy(() => import("./pages/MaturityAssessment"));
const NotFound = lazy(() => import("./pages/NotFound"));

export function AcademyV2Routes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
        <Route path="/" element={<AcademyHome />} />
        <Route path="dashboard" element={<AcademyDashboard />} />
        <Route path="pillar/:pillarNumber" element={<PillarOverview />} />
        <Route path="quiz/:pillarNumber" element={<Quiz />} />
        <Route path="ai-tutor" element={<AITutor />} />
        <Route path="profile" element={<Profile />} />
        <Route path="resources" element={<Resources />} />
        <Route path="certifications" element={<Certifications />} />
        <Route path="simulations" element={<Simulations />} />
        <Route path="simulation-progress" element={<SimulationProgress />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="value-tree-builder" element={<ValueTreeBuilder />} />
        <Route path="maturity-assessment" element={<MaturityAssessment />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default AcademyV2Routes;
