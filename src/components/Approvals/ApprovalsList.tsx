/**
 * Phase 2: Approvals List Component
 * 
 * Displays a list of pending approval requests for approvers.
 */

import React, { useState, useEffect } from 'react';
import ApprovalRequest, { ApprovalRequestData } from './ApprovalRequest';

interface ApprovalsListProps {
  apiBaseUrl?: string;
  onApprovalComplete?: () => void;
}

export const ApprovalsList: React.FC<ApprovalsListProps> = ({
  apiBaseUrl = '/api/approvals',
  onApprovalComplete,
}) => {
  const [requests, setRequests] = useState<ApprovalRequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  // Fetch approval requests
  const fetchRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/pending`);
      if (!response.ok) {
        throw new Error('Failed to fetch approval requests');
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // Refresh every 30 seconds
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  // Handle approve
  const handleApprove = async (requestId: string, secondApproverEmail?: string, notes?: string) => {
    const response = await fetch(`${apiBaseUrl}/${requestId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secondApproverEmail, notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to approve request');
    }

    // Refresh list
    await fetchRequests();
    onApprovalComplete?.();
  };

  // Handle reject
  const handleReject = async (requestId: string, notes?: string) => {
    const response = await fetch(`${apiBaseUrl}/${requestId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reject request');
    }

    // Refresh list
    await fetchRequests();
    onApprovalComplete?.();
  };

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    if (filter === 'pending') return req.status === 'pending';
    if (filter === 'completed') return ['approved', 'rejected'].includes(req.status);
    return true;
  });

  if (loading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchRequests}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Approval Requests</h2>
        <button
          onClick={fetchRequests}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'pending'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pending ({requests.filter(r => r.status === 'pending').length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'completed'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Completed ({requests.filter(r => ['approved', 'rejected'].includes(r.status)).length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'all'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All ({requests.length})
        </button>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-600">
            {filter === 'pending' ? 'No pending approval requests' : 'No requests found'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <ApprovalRequest
              key={request.id}
              request={request}
              onApprove={handleApprove}
              onReject={handleReject}
              currentUserCanApprove={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ApprovalsList;
