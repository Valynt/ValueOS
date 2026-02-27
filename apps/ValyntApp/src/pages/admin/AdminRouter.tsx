/**
 * Admin Router
 *
 * Route definitions for /admin/* paths.
 * Each route maps to a section in the admin IA.
 * Placeholder pages are used for sections not yet implemented.
 *
 * See: docs/architecture/admin-settings-ia.md
 */

import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';

// Existing pages that map to new routes
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const UsersPage = lazy(() => import('./UsersPage'));
const SecurityDashboard = lazy(() => import('./SecurityDashboard'));

/**
 * Placeholder for admin sections not yet implemented.
 * Shows the section name and a "coming soon" message.
 */
const AdminPlaceholder: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <div className="bg-white rounded-lg border border-gray-200 p-8">
    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    <p className="mt-2 text-sm text-gray-500">{description}</p>
    <div className="mt-6 p-4 bg-gray-50 rounded border border-dashed border-gray-300 text-sm text-gray-400">
      This section is defined in the admin IA but not yet implemented.
    </div>
  </div>
);

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-32">
    <div className="text-sm text-gray-400">Loading...</div>
  </div>
);

/**
 * Admin route tree.
 *
 * Mount this at /admin in the app router:
 * <Route path="/admin/*" element={<AdminRouter />} />
 */
export const AdminRouter: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route element={<AdminLayout />}>
          {/* Default redirect */}
          <Route index element={<Navigate to="governance/organization" replace />} />

          {/* 1. Governance */}
          <Route path="governance/organization" element={
            <AdminPlaceholder title="Organization Profile" description="Organization name, domain, and profile settings" />
          } />
          <Route path="governance/boundaries" element={
            <AdminPlaceholder title="Tenant Boundaries" description="Data residency, namespace isolation, and tenant limits" />
          } />
          <Route path="governance/workspaces" element={
            <AdminPlaceholder title="Workspaces" description="Create and manage workspaces within the organization" />
          } />
          <Route path="governance/entitlements" element={
            <AdminPlaceholder title="Feature Entitlements" description="View features available on your plan tier" />
          } />
          <Route path="governance/environments" element={
            <AdminPlaceholder title="Environment Controls" description="Production, staging, and sandbox environment configuration" />
          } />

          {/* 2. Identity & Access */}
          <Route path="identity/users" element={
            <Suspense fallback={<LoadingFallback />}>
              <UsersPage />
            </Suspense>
          } />
          <Route path="identity/roles" element={
            <AdminPlaceholder title="Roles" description="Define and assign roles with permission sets" />
          } />
          <Route path="identity/policies" element={
            <AdminPlaceholder title="Role Policies" description="Configure permission boundaries and policy constraints" />
          } />
          <Route path="identity/delegation" element={
            <AdminPlaceholder title="Delegated Administration" description="Delegate admin capabilities to workspace-level administrators" />
          } />
          <Route path="identity/reviews" element={
            <AdminPlaceholder title="Access Reviews" description="Periodic access review campaigns for compliance" />
          } />

          {/* 3. Security Posture */}
          <Route path="security/sso" element={
            <AdminPlaceholder title="SSO Configuration" description="Configure SAML/OIDC single sign-on providers" />
          } />
          <Route path="security/mfa" element={
            <AdminPlaceholder title="MFA Enforcement" description="Enforce multi-factor authentication for all users" />
          } />
          <Route path="security/sessions" element={
            <AdminPlaceholder title="Password & Session Policies" description="Password complexity, session timeout, and idle policies" />
          } />
          <Route path="security/api-keys" element={
            <AdminPlaceholder title="API Keys" description="Create, rotate, and revoke API keys" />
          } />
          <Route path="security/webhook-secrets" element={
            <AdminPlaceholder title="Webhook Secrets" description="Manage webhook signing secrets and rotation" />
          } />
          <Route path="security/export" element={
            <AdminPlaceholder title="Data Export Controls" description="Control data export capabilities and restrictions" />
          } />

          {/* 4. Agent Governance */}
          <Route path="agents/registry" element={
            <AdminPlaceholder title="Agent Registry" description="View and manage enabled agents, their status, and execution environment" />
          } />
          <Route path="agents/model-policies" element={
            <AdminPlaceholder title="Model Policies" description="Allowed models, fallback rules, and enterprise model gating" />
          } />
          <Route path="agents/tool-access" element={
            <AdminPlaceholder title="Tool Access Controls" description="Approved integrations per agent, API allowlists, data classification" />
          } />
          <Route path="agents/guardrails" element={
            <AdminPlaceholder title="Execution Guardrails" description="Max steps, rate limits, token budgets, and human review triggers" />
          } />
          <Route path="agents/confidence" element={
            <AdminPlaceholder title="Confidence & Veto Policies" description="Minimum confidence thresholds, integrity veto rules, auto-escalation" />
          } />
          <Route path="agents/costs" element={
            <AdminPlaceholder title="Cost & Rate Controls" description="Per-agent budget caps, alert thresholds, auto-disable on breach" />
          } />
          <Route path="agents/retention" element={
            <AdminPlaceholder title="Data Retention Rules" description="Log retention windows, artifact retention, redaction policies" />
          } />

          {/* 5. Data & Integrations */}
          <Route path="data/integrations" element={
            <AdminPlaceholder title="External Integrations" description="Connect external services and data sources" />
          } />
          <Route path="data/webhooks" element={
            <AdminPlaceholder title="Webhooks" description="Configure outbound event webhook subscriptions" />
          } />
          <Route path="data/pipelines" element={
            <AdminPlaceholder title="Data Pipelines" description="Manage data ingestion and transformation pipelines" />
          } />
          <Route path="data/storage" element={
            <AdminPlaceholder title="Storage & Retention" description="Storage quotas, retention policies, and data lifecycle" />
          } />
          <Route path="data/events" element={
            <AdminPlaceholder title="Event Destinations" description="Route domain events to external systems" />
          } />

          {/* 6. Compliance & Audit */}
          <Route path="compliance/audit-logs" element={
            <AdminPlaceholder title="Audit Logs" description="View and export activity logs for compliance and forensics" />
          } />
          <Route path="compliance/policy-history" element={
            <AdminPlaceholder title="Policy History" description="Track all policy and configuration changes over time" />
          } />
          <Route path="compliance/retention" element={
            <AdminPlaceholder title="Retention Schedule" description="Configure data and log retention schedules" />
          } />
          <Route path="compliance/dsr" element={
            <AdminPlaceholder title="Data Subject Requests" description="Process GDPR data subject access and deletion requests" />
          } />
          <Route path="compliance/mode" element={
            <AdminPlaceholder title="Compliance Mode" description="Enable SOC2, GDPR, or HIPAA compliance modes" />
          } />

          {/* 7. Billing & Usage */}
          <Route path="billing/plan" element={
            <AdminPlaceholder title="Plan Tier" description="Current plan, upgrade options, and contract details" />
          } />
          <Route path="billing/usage" element={
            <AdminPlaceholder title="Usage Overview" description="Current utilization, included limits, and forecasted overage" />
          } />
          <Route path="billing/agent-costs" element={
            <AdminPlaceholder title="Agent Cost Breakdown" description="Per-agent spend, model cost distribution, tool/API attribution" />
          } />
          <Route path="billing/overage" element={
            <AdminPlaceholder title="Overage Policy" description="Overage formula, escalation triggers, and throttling behavior" />
          } />
          <Route path="billing/rate-limits" element={
            <AdminPlaceholder title="Rate Limits & Throttling" description="Current rate limits, grace periods, and what happens at capacity" />
          } />

          {/* 8. Platform (Internal Only) */}
          <Route path="platform/tenants" element={
            <AdminPlaceholder title="Tenant Registry" description="View and manage all tenants across the platform" />
          } />
          <Route path="platform/overrides" element={
            <AdminPlaceholder title="Cross-Tenant Overrides" description="Override tenant-level settings from the platform level" />
          } />
          <Route path="platform/feature-flags" element={
            <AdminPlaceholder title="Feature Flags" description="Manage feature flag rollouts across tenants" />
          } />
          <Route path="platform/incidents" element={
            <AdminPlaceholder title="Incident Controls" description="Emergency controls: tenant suspension, agent kill switches, rate overrides" />
          } />

          {/* Legacy dashboard route */}
          <Route path="dashboard" element={
            <Suspense fallback={<LoadingFallback />}>
              <AdminDashboard />
            </Suspense>
          } />
          <Route path="security-dashboard" element={
            <Suspense fallback={<LoadingFallback />}>
              <SecurityDashboard />
            </Suspense>
          } />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default AdminRouter;
