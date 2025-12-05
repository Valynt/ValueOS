import React, { useState } from 'react';
import { SettingsSection } from './SettingsSection';
import { SaveIndicator, useAutoSave } from '../Common/SaveIndicator';
import { ConfirmationModal } from '../Common/ConfirmationModal';
import { HelpTooltip } from '../Common/Tooltip';
import { SkeletonForm } from '../Common/SkeletonLoader';
import { EmptyState } from '../Common/EmptyState';
import { useDirtyState, useBeforeUnload } from '../../hooks/useDirtyState';
import { useOptimisticUpdate } from '../../hooks/useOptimisticUpdate';
import { announceToScreenReader } from '../../utils/accessibility';
import { Trash2, Users } from 'lucide-react';

export const EnhancedSettingsExample: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const initialSettings = {
    notificationsEnabled: true,
    emailFrequency: 'daily',
    theme: 'light',
  };

  const { state, isDirty, updateState, resetState, saveState } = useDirtyState(
    initialSettings,
    (dirty) => {
      if (dirty) {
        announceToScreenReader('You have unsaved changes', 'polite');
      }
    }
  );

  useBeforeUnload(isDirty);

  const saveSettings = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    saveState();
    announceToScreenReader('Settings saved successfully', 'polite');
  };

  const { status, triggerSave } = useAutoSave(saveSettings, 1500);

  const { execute: handleDelete } = useOptimisticUpdate(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
    {
      announceSuccess: 'Item deleted successfully',
      announceError: 'Failed to delete item',
    }
  );

  const handleChange = (key: keyof typeof initialSettings, value: any) => {
    updateState({ [key]: value });
    triggerSave();
  };

  if (loading) {
    return (
      <SettingsSection
        title="Enhanced Settings"
        description="Example of all UI/UX features"
      >
        <SkeletonForm fields={3} />
      </SettingsSection>
    );
  }

  return (
    <>
      <SettingsSection
        title="Enhanced Settings Example"
        description="Demonstrates all 13 UI/UX features"
        actions={<SaveIndicator status={status} />}
      >
        <div className="space-y-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <label
                htmlFor="notifications-toggle"
                className="text-sm font-medium text-gray-700"
              >
                Enable Notifications
              </label>
              <HelpTooltip
                content="Receive email notifications for important updates"
                position="right"
              />
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="notifications-toggle"
                type="checkbox"
                className="sr-only peer"
                checked={state.notificationsEnabled}
                onChange={(e) =>
                  handleChange('notificationsEnabled', e.target.checked)
                }
                aria-describedby="notifications-description"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span id="notifications-description" className="ml-3 text-sm text-gray-600">
                {state.notificationsEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-2">
              <label
                htmlFor="email-frequency"
                className="text-sm font-medium text-gray-700"
              >
                Email Frequency
              </label>
              <HelpTooltip
                content="Choose how often you want to receive email digests"
                position="right"
              />
            </div>
            <select
              id="email-frequency"
              value={state.emailFrequency}
              onChange={(e) => handleChange('emailFrequency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select email frequency"
            >
              <option value="realtime">Real-time</option>
              <option value="daily">Daily Digest</option>
              <option value="weekly">Weekly Summary</option>
              <option value="never">Never</option>
            </select>
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-2">
              <label className="text-sm font-medium text-gray-700">Theme</label>
              <HelpTooltip
                content="Choose your preferred color theme"
                position="right"
              />
            </div>
            <div className="flex space-x-4" role="radiogroup" aria-label="Theme selection">
              {['light', 'dark', 'auto'].map((theme) => (
                <label key={theme} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value={theme}
                    checked={state.theme === theme}
                    onChange={(e) => handleChange('theme', e.target.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
                    aria-label={`${theme.charAt(0).toUpperCase() + theme.slice(1)} theme`}
                  />
                  <span className="text-sm text-gray-700 capitalize">{theme}</span>
                </label>
              ))}
            </div>
          </div>

          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Invite team members to collaborate on your projects"
            action={{
              label: 'Invite Members',
              onClick: () => announceToScreenReader('Opening invite dialog'),
              icon: Users,
            }}
          />
        </div>

        {isDirty && (
          <div
            className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
            role="alert"
            aria-live="polite"
          >
            <p className="text-sm text-yellow-800">
              You have unsaved changes. They will be saved automatically.
            </p>
            <button
              onClick={resetState}
              className="mt-2 text-sm text-yellow-700 hover:text-yellow-900 underline focus:outline-none focus:ring-2 focus:ring-yellow-500 rounded"
            >
              Discard changes
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-between items-center pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="Delete settings"
          >
            <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
            Delete Settings
          </button>
        </div>
      </SettingsSection>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => handleDelete()}
        title="Delete Settings?"
        message="This action cannot be undone. All your custom settings will be permanently deleted."
        confirmText="Delete"
        requireTypedConfirmation
        confirmationPhrase="DELETE"
        isDangerous
      />
    </>
  );
};
