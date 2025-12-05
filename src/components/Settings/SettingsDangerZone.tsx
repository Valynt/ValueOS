import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { DangerZoneAction } from '../../types';

interface SettingsDangerZoneProps {
  actions: DangerZoneAction[];
}

export const SettingsDangerZone: React.FC<SettingsDangerZoneProps> = ({ actions }) => {
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const handleConfirm = async (action: DangerZoneAction) => {
    if (action.confirmText && confirmText !== action.confirmText) {
      return;
    }

    setIsExecuting(true);
    try {
      await action.onConfirm();
      setConfirmingAction(null);
      setConfirmText('');
    } catch (error) {
      logger.error('Action failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = () => {
    setConfirmingAction(null);
    setConfirmText('');
  };

  return (
    <div className="bg-white rounded-lg border-2 border-red-200 overflow-hidden">
      <div className="px-6 py-4 bg-red-50 border-b border-red-200">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
        </div>
        <p className="text-sm text-red-700 mt-1">
          These actions are permanent and cannot be undone. Please proceed with caution.
        </p>
      </div>

      <div className="divide-y divide-red-100">
        {actions.map((action, index) => (
          <div key={index} className="px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">{action.label}</h4>
                <p className="text-sm text-gray-600 mt-1">{action.description}</p>
              </div>

              {confirmingAction === action.label ? (
                <div className="ml-4 space-y-3">
                  {action.confirmText && (
                    <div>
                      <p className="text-sm text-gray-700 mb-2">
                        Type <span className="font-mono font-semibold">{action.confirmText}</span> to confirm:
                      </p>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder={action.confirmText}
                        autoFocus
                      />
                    </div>
                  )}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleConfirm(action)}
                      disabled={
                        isExecuting ||
                        (action.confirmText ? confirmText !== action.confirmText : false)
                      }
                      className="flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isExecuting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Confirm
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isExecuting}
                      className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingAction(action.label)}
                  className="ml-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  {action.buttonText}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
