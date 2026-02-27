import React, { useCallback, useState } from 'react';
import type { SensitivityLevel } from '../../lib/adminNavigation';

interface ConfirmationModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when the user confirms or cancels */
  onClose: (confirmed: boolean) => void;
  /** Title of the action being confirmed */
  title: string;
  /** Plain-language description of the impact */
  description: string;
  /** Sensitivity level determines the confirmation UX */
  sensitivity: SensitivityLevel;
  /**
   * For destructive actions: the exact string the user must type to confirm.
   * Ignored for 'normal' and 'sensitive' levels.
   */
  confirmationPhrase?: string;
}

/**
 * Confirmation modal for admin settings changes.
 *
 * - normal: simple confirm/cancel
 * - sensitive: re-authentication prompt (password or WebAuthn)
 * - destructive: type-to-confirm with explicit impact warning
 */
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  onClose,
  title,
  description,
  sensitivity,
  confirmationPhrase,
}) => {
  const [typedPhrase, setTypedPhrase] = useState('');

  const handleConfirm = useCallback(() => {
    if (sensitivity === 'destructive' && confirmationPhrase) {
      if (typedPhrase !== confirmationPhrase) return;
    }
    setTypedPhrase('');
    onClose(true);
  }, [sensitivity, confirmationPhrase, typedPhrase, onClose]);

  const handleCancel = useCallback(() => {
    setTypedPhrase('');
    onClose(false);
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    },
    [handleCancel]
  );

  if (!open) return null;

  const isDestructiveReady =
    sensitivity !== 'destructive' ||
    !confirmationPhrase ||
    typedPhrase === confirmationPhrase;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          {sensitivity === 'destructive' && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          )}
          {sensitivity === 'sensitive' && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          )}
          <div>
            <h2 id="confirm-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <p id="confirm-description" className="mt-1 text-sm text-gray-600">
              {description}
            </p>
          </div>
        </div>

        {/* Sensitive: re-auth prompt */}
        {sensitivity === 'sensitive' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
            Re-authentication required. You will be prompted to verify your identity.
          </div>
        )}

        {/* Destructive: type-to-confirm */}
        {sensitivity === 'destructive' && confirmationPhrase && (
          <div className="mt-4">
            <p className="text-sm text-gray-700 mb-2">
              Type <code className="px-1.5 py-0.5 bg-gray-100 rounded text-red-700 font-mono text-xs">{confirmationPhrase}</code> to confirm:
            </p>
            <input
              type="text"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder={confirmationPhrase}
              autoFocus
              aria-label={`Type "${confirmationPhrase}" to confirm`}
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isDestructiveReady}
            className={
              sensitivity === 'destructive'
                ? 'px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed'
                : 'px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }
          >
            {sensitivity === 'destructive' ? 'Confirm Destructive Action' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
