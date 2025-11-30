/**
 * Phase 2: Approval Request Component
 * 
 * Displays a single approval request with approve/reject actions.
 * Handles dual control requirement for high-cost/sensitive operations.
 */

import React, { useState } from 'react';

export interface ApprovalRequestData {
  id: string;
  agentName: string;
  action: string;
  description?: string;
  estimatedCost: number;
  isDestructive: boolean;
  involvesDataExport: boolean;
  requiresDualControl: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  requestedAt: string;
  expiresAt: string;
}

interface ApprovalRequestProps {
  request: ApprovalRequestData;
  onApprove: (requestId: string, secondApproverEmail?: string, notes?: string) => Promise<void>;
  onReject: (requestId: string, notes?: string) => Promise<void>;
  currentUserCanApprove?: boolean;
}

export const ApprovalRequest: React.FC<ApprovalRequestProps> = ({
  request,
  onApprove,
  onReject,
  currentUserCanApprove = true,
}) => {
  const [secondApproverEmail, setSecondApproverEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    // Validate dual control if required
    if (request.requiresDualControl && !secondApproverEmail) {
      setError('Second approver email is required for this request');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onApprove(
        request.id,
        request.requiresDualControl ? secondApproverEmail : undefined,
        notes || undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Are you sure you want to reject this request?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onReject(request.id, notes || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setLoading(false);
    }
  };

  // Calculate time remaining
  const expiresAt = new Date(request.expiresAt);
  const now = new Date();
  const hoursRemaining = Math.max(0, (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));

  // Status badge color
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold">{request.action}</h3>
            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[request.status]}`}>
              {request.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-gray-600">Agent: <span className="font-medium">{request.agentName}</span></p>
        </div>
        {request.status === 'pending' && (
          <div className="text-right">
            <p className="text-sm text-gray-600">Expires in</p>
            <p className="text-lg font-semibold text-orange-600">{hoursRemaining.toFixed(1)}h</p>
          </div>
        )}
      </div>

      {/* Description */}
      {request.description && (
        <p className="text-sm text-gray-700 mb-4">{request.description}</p>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded">
        <div>
          <p className="text-xs text-gray-500 mb-1">Estimated Cost</p>
          <p className="text-lg font-semibold">${request.estimatedCost.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Request Type</p>
          <div className="flex gap-1">
            {request.isDestructive && (
              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">Destructive</span>
            )}
            {request.involvesDataExport && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Data Export</span>
            )}
            {request.requiresDualControl && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Dual Control</span>
            )}
          </div>
        </div>
      </div>

      {/* Dual Control Warning */}
      {request.requiresDualControl && request.status === 'pending' && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-purple-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-purple-900 text-sm">Dual Control Required</p>
              <p className="text-purple-700 text-xs mt-1">
                This request requires a second approver due to {request.estimatedCost > 100 ? 'high cost' : 'sensitive nature'}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Approval Form (only for pending requests) */}
      {request.status === 'pending' && currentUserCanApprove && (
        <div className="space-y-3">
          {/* Second Approver Input (if dual control required) */}
          {request.requiresDualControl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Second Approver Email *
              </label>
              <input
                type="email"
                value={secondApproverEmail}
                onChange={(e) => setSecondApproverEmail(e.target.value)}
                placeholder="approver@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any comments or justification..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              {loading ? 'Processing...' : 'Approve'}
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition-colors"
            >
              {loading ? 'Processing...' : 'Reject'}
            </button>
          </div>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-xs text-gray-500 mt-4">
        Requested {new Date(request.requestedAt).toLocaleString()}
      </p>
    </div>
  );
};

export default ApprovalRequest;
