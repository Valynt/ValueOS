/**
 * Documentation Admin Dashboard
 * 
 * Shows documentation health metrics, coverage, and sync status.
 * Only visible to admin users.
 */

import React, { useEffect } from 'react';
import { useDocumentation } from '../../hooks/useDocumentation';

export const DocsAdminDashboard: React.FC = () => {
  const { health, fetchHealth, loading } = useDocumentation();

  useEffect(() => {
    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading && !health) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center text-gray-500">
          <p>Unable to load health metrics</p>
        </div>
      </div>
    );
  }

  const statusColor = health.status === 'healthy' ? 'green' : health.status === 'degraded' ? 'yellow' : 'red';

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Documentation Health Dashboard
        </h1>
        <p className="text-gray-600">
          Monitor documentation coverage, sync status, and health metrics
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Status</h3>
            <div className={`w-3 h-3 rounded-full bg-${statusColor}-500`}></div>
          </div>
          <p className={`text-2xl font-bold text-${statusColor}-600 capitalize`}>
            {health.status}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Sections</h3>
          <p className="text-2xl font-bold text-gray-900">{health.sections}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Code Mappings</h3>
          <p className="text-2xl font-bold text-gray-900">{health.mappings}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Coverage</h3>
          <p className="text-2xl font-bold text-blue-600">{health.coverage}</p>
        </div>
      </div>

      {/* Outdated Docs Alert */}
      {health.outdated > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-900 mb-1">
                {health.outdated} {health.outdated === 1 ? 'Section' : 'Sections'} Need Updates
              </h3>
              <p className="text-yellow-800 mb-4">
                Code changes have been detected that may require documentation updates.
              </p>
              <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                Review Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issues */}
      {health.issues && health.issues.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Issues Detected
          </h2>
          <div className="space-y-4">
            {health.issues.map((issue, index) => (
              <div
                key={index}
                className={`border-l-4 p-4 rounded-r ${
                  issue.severity === 'high' ? 'border-red-500 bg-red-50' :
                  issue.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">
                      {formatIssueType(issue.type)}
                    </h3>
                    <p className="text-sm text-gray-700 mb-2">
                      {issue.description}
                    </p>
                    {issue.affectedItems.length > 0 && (
                      <details className="text-sm text-gray-600">
                        <summary className="cursor-pointer hover:text-gray-900">
                          {issue.affectedItems.length} affected {issue.affectedItems.length === 1 ? 'item' : 'items'}
                        </summary>
                        <ul className="mt-2 ml-4 space-y-1">
                          {issue.affectedItems.map((item, i) => (
                            <li key={i} className="list-disc">{item}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    issue.severity === 'high' ? 'bg-red-100 text-red-800' :
                    issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {issue.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Sync */}
      {health.lastSync && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Sync Information
          </h2>
          <div className="flex items-center gap-2 text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Last synced: {new Date(health.lastSync).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={fetchHealth}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh Metrics
        </button>
        <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
          Export Report
        </button>
      </div>
    </div>
  );
};

function formatIssueType(type: string): string {
  return type
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default DocsAdminDashboard;
