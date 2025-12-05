/**
 * User Notification Preferences
 * 
 * Allows users to configure:
 * - Email notifications
 * - Push notifications
 * - In-app notifications
 * - Slack notifications
 * - Do Not Disturb mode
 */

import React from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { useSettingsGroup } from '../../lib/settingsRegistry';
import { Bell, Mail, Smartphone, MessageSquare, Moon, Loader2 } from 'lucide-react';

interface UserNotificationsProps {
  userId: string;
}

export const UserNotifications: React.FC<UserNotificationsProps> = ({ userId }) => {
  const { values, loading, updateSetting } = useSettingsGroup(
    [
      'user.notifications.email',
      'user.notifications.push',
      'user.notifications.slack',
      'user.notifications.inApp',
    ],
    { userId },
    { scope: 'user' }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const notificationTypes = [
    {
      key: 'email',
      label: 'Email Notifications',
      description: 'Receive notifications via email',
      icon: Mail,
    },
    {
      key: 'push',
      label: 'Push Notifications',
      description: 'Receive push notifications on your devices',
      icon: Smartphone,
    },
    {
      key: 'slack',
      label: 'Slack Notifications',
      description: 'Receive notifications in Slack',
      icon: MessageSquare,
    },
    {
      key: 'inApp',
      label: 'In-App Notifications',
      description: 'Show notifications within the application',
      icon: Bell,
    },
  ];

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Notification Preferences"
        description="Choose how you want to be notified"
        icon={<Bell className="w-5 h-5" />}
      >
        <div className="space-y-4">
          {notificationTypes.map((type) => {
            const Icon = type.icon;
            const settingKey = `user.notifications.${type.key}`;
            const isEnabled = values[settingKey] ?? true;

            return (
              <div key={type.key} className="flex items-center justify-between py-3">
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-gray-900">{type.label}</div>
                    <div className="text-sm text-gray-500">{type.description}</div>
                  </div>
                </div>
                <button
                  onClick={() => updateSetting(settingKey, !isEnabled)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${isEnabled ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </SettingsSection>
    </div>
  );
};
