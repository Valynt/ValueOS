/**
 * ApprovalDrawer Component - Drawer for requesting approvals
 */

import { useState } from 'react';

interface ApprovalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export function ApprovalDrawer({ isOpen, onClose, onSubmit }: ApprovalDrawerProps) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    const trimmedReason = reason.trim();
    if (trimmedReason.length > 0) {
      onSubmit(trimmedReason);
      setReason('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="p-4 border-b border-neutral-200">
          <h3 className="text-lg font-semibold text-neutral-900">Request Approval</h3>
          <p className="text-sm text-neutral-500">Submit this value case for approval</p>
        </div>

        <div className="p-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Reason for Approval
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe why this value case should be approved..."
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
          />
        </div>

        <div className="p-4 border-t border-neutral-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={reason.trim().length === 0}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}
