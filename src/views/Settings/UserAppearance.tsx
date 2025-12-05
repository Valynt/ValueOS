/**
 * User Appearance & Accessibility Settings
 * 
 * Allows users to customize:
 * - Theme (light, dark, system)
 * - Language
 * - Timezone
 * - Date/time format
 * - Accessibility options
 */

import React from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { useSettings, useSettingsGroup } from '../../lib/settingsRegistry';
import { Monitor, Sun, Moon, Globe, Clock, Calendar, Eye, Loader2 } from 'lucide-react';

interface UserAppearanceProps {
  userId: string;
}

export const UserAppearance: React.FC<UserAppearanceProps> = ({ userId }) => {
  const { values, loading, updateSetting } = useSettingsGroup(
    [
      'user.theme',
      'user.language',
      'user.timezone',
      'user.dateFormat',
      'user.timeFormat',
      'user.accessibility.highContrast',
      'user.accessibility.fontSize',
      'user.accessibility.reducedMotion',
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

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'ja', label: '日本語' },
    { value: 'zh', label: '中文' },
  ];

  const timezones = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
    { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
    { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Asia/Shanghai', label: 'Shanghai' },
    { value: 'Australia/Sydney', label: 'Sydney' },
  ];

  const dateFormats = [
    { value: 'MM/DD/YYYY', label: '12/31/2025 (MM/DD/YYYY)' },
    { value: 'DD/MM/YYYY', label: '31/12/2025 (DD/MM/YYYY)' },
    { value: 'YYYY-MM-DD', label: '2025-12-31 (YYYY-MM-DD)' },
    { value: 'MMM DD, YYYY', label: 'Dec 31, 2025' },
  ];

  const timeFormats = [
    { value: '12h', label: '12-hour (3:45 PM)' },
    { value: '24h', label: '24-hour (15:45)' },
  ];

  const fontSizes = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
    { value: 'extra-large', label: 'Extra Large' },
  ];

  return (
    <div className="space-y-6">
      {/* Theme */}
      <SettingsSection
        title="Theme"
        description="Choose your preferred color scheme"
        icon={<Sun className="w-5 h-5" />}
      >
        <div className="grid grid-cols-3 gap-4">
          {themes.map((theme) => {
            const Icon = theme.icon;
            const isSelected = values['user.theme'] === theme.value;

            return (
              <button
                key={theme.value}
                onClick={() => updateSetting('user.theme', theme.value)}
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                  ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                <span className={`text-sm font-medium ${isSelected ? 'text-blue-600' : 'text-gray-700'}`}>
                  {theme.label}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Language */}
      <SettingsSection
        title="Language"
        description="Select your preferred language"
        icon={<Globe className="w-5 h-5" />}
      >
        <select
          value={values['user.language'] || 'en'}
          onChange={(e) => updateSetting('user.language', e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {languages.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </SettingsSection>

      {/* Timezone */}
      <SettingsSection
        title="Timezone"
        description="Set your local timezone for accurate time display"
        icon={<Clock className="w-5 h-5" />}
      >
        <select
          value={values['user.timezone'] || 'UTC'}
          onChange={(e) => updateSetting('user.timezone', e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {timezones.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </SettingsSection>

      {/* Date & Time Format */}
      <SettingsSection
        title="Date & Time Format"
        description="Customize how dates and times are displayed"
        icon={<Calendar className="w-5 h-5" />}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Format
            </label>
            <select
              value={values['user.dateFormat'] || 'MM/DD/YYYY'}
              onChange={(e) => updateSetting('user.dateFormat', e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {dateFormats.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Format
            </label>
            <select
              value={values['user.timeFormat'] || '12h'}
              onChange={(e) => updateSetting('user.timeFormat', e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {timeFormats.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SettingsSection>

      {/* Accessibility */}
      <SettingsSection
        title="Accessibility"
        description="Customize display options for better accessibility"
        icon={<Eye className="w-5 h-5" />}
      >
        <div className="space-y-4">
          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">High Contrast Mode</div>
              <div className="text-sm text-gray-500">
                Increase contrast for better visibility
              </div>
            </div>
            <button
              onClick={() =>
                updateSetting(
                  'user.accessibility.highContrast',
                  !values['user.accessibility.highContrast']
                )
              }
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${
                  values['user.accessibility.highContrast']
                    ? 'bg-blue-600'
                    : 'bg-gray-200'
                }
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${
                    values['user.accessibility.highContrast']
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }
                `}
              />
            </button>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Font Size
            </label>
            <select
              value={values['user.accessibility.fontSize'] || 'medium'}
              onChange={(e) => updateSetting('user.accessibility.fontSize', e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {fontSizes.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reduced Motion */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Reduce Motion</div>
              <div className="text-sm text-gray-500">
                Minimize animations and transitions
              </div>
            </div>
            <button
              onClick={() =>
                updateSetting(
                  'user.accessibility.reducedMotion',
                  !values['user.accessibility.reducedMotion']
                )
              }
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${
                  values['user.accessibility.reducedMotion']
                    ? 'bg-blue-600'
                    : 'bg-gray-200'
                }
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${
                    values['user.accessibility.reducedMotion']
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }
                `}
              />
            </button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};
