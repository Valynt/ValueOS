import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';

import { AdminLayout } from './AdminLayout';

const AdminDashboard = lazy(() => import('./AdminDashboard'));
const UsersPage = lazy(() => import('./UsersPage'));
const SecurityDashboard = lazy(() => import('./SecurityDashboard').then((m) => ({ default: m.SecurityDashboard })));
const AuditLogsPage = lazy(() => import('./compliance/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })));
const PolicyHistoryPage = lazy(() => import('./compliance/PolicyHistoryPage').then((m) => ({ default: m.PolicyHistoryPage })));
const RetentionPage = lazy(() => import('./compliance/RetentionPage').then((m) => ({ default: m.RetentionPage })));
const DsrPage = lazy(() => import('./compliance/DsrPage').then((m) => ({ default: m.DsrPage })));
const ComplianceModePage = lazy(() => import('./compliance/ComplianceModePage').then((m) => ({ default: m.ComplianceModePage })));

const LoadingFallback = () => <div className="flex items-center justify-center h-32"><div className="text-sm text-gray-400">Loading...</div></div>;

export const AdminRouter: React.FC = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="identity/users" element={<UsersPage />} />
          <Route path="security-dashboard" element={<SecurityDashboard />} />

          <Route path="compliance/audit-logs" element={<AuditLogsPage />} />
          <Route path="compliance/policy-history" element={<PolicyHistoryPage />} />
          <Route path="compliance/retention" element={<RetentionPage />} />
          <Route path="compliance/dsr" element={<DsrPage />} />
          <Route path="compliance/mode" element={<ComplianceModePage />} />

          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

export default AdminRouter;
