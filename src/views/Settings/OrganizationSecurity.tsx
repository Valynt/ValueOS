import React, { useState } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import {
  Shield, Lock, Clock, Users, Globe, Plus, Trash2, Check, AlertCircle, Key
} from 'lucide-react';
import { AuthPolicy, AllowedDomain } from '../../types';

export const OrganizationSecurity: React.FC = () => {
  const [policy, setPolicy] = useState<AuthPolicy>({
    id: '1',
    ssoEnforced: false,
    mfaRequired: true,
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireNumbers: true,
    passwordRequireSymbols: true,
    passwordExpiryDays: 90,
    sessionTimeoutMinutes: 60,
    idleTimeoutMinutes: 30,
    maxConcurrentSessions: 3,
  });

  const [domains, setDomains] = useState<AllowedDomain[]>([
    {
      id: '1',
      domain: 'example.com',
      type: 'whitelist',
      autoProvision: true,
      createdAt: '2024-01-01',
    },
  ]);

  const [newDomain, setNewDomain] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSavePolicy = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
  };

  const handleAddDomain = () => {
    if (!newDomain) return;

    setDomains([
      ...domains,
      {
        id: `${domains.length + 1}`,
        domain: newDomain,
        type: 'whitelist',
        autoProvision: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewDomain('');
  };

  const handleRemoveDomain = (id: string) => {
    setDomains(domains.filter(d => d.id !== id));
  };

  return (
    <div className="space-y-6">
      <SettingsSection title="Authentication Policy" description="Configure security requirements for user authentication">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Enforce SSO</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Require Single Sign-On for all users
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={policy.ssoEnforced}
                  onChange={(e) => setPolicy({ ...policy, ssoEnforced: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <Key className="h-5 w-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Require MFA</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Multi-factor authentication required
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={policy.mfaRequired}
                  onChange={(e) => setPolicy({ ...policy, mfaRequired: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Password Requirements</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Length</label>
                <input
                  type="number"
                  value={policy.passwordMinLength}
                  onChange={(e) => setPolicy({ ...policy, passwordMinLength: parseInt(e.target.value) })}
                  min="8"
                  max="32"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Expiry (days)</label>
                <input
                  type="number"
                  value={policy.passwordExpiryDays}
                  onChange={(e) => setPolicy({ ...policy, passwordExpiryDays: parseInt(e.target.value) })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">0 = never expires</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={policy.passwordRequireUppercase}
                  onChange={(e) => setPolicy({ ...policy, passwordRequireUppercase: e.target.checked })}
                  className="rounded border-gray-300 focus:ring-blue-500"
                />
                <span>Require uppercase letters</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={policy.passwordRequireNumbers}
                  onChange={(e) => setPolicy({ ...policy, passwordRequireNumbers: e.target.checked })}
                  className="rounded border-gray-300 focus:ring-blue-500"
                />
                <span>Require numbers</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={policy.passwordRequireSymbols}
                  onChange={(e) => setPolicy({ ...policy, passwordRequireSymbols: e.target.checked })}
                  className="rounded border-gray-300 focus:ring-blue-500"
                />
                <span>Require special characters</span>
              </label>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Session Management" description="Configure session timeout and concurrent session limits">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="inline h-4 w-4 mr-1" />
              Session Timeout
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={policy.sessionTimeoutMinutes}
                onChange={(e) => setPolicy({ ...policy, sessionTimeoutMinutes: parseInt(e.target.value) })}
                min="15"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">min</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="inline h-4 w-4 mr-1" />
              Idle Timeout
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={policy.idleTimeoutMinutes}
                onChange={(e) => setPolicy({ ...policy, idleTimeoutMinutes: parseInt(e.target.value) })}
                min="5"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">min</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Users className="inline h-4 w-4 mr-1" />
              Max Sessions
            </label>
            <input
              type="number"
              value={policy.maxConcurrentSessions}
              onChange={(e) => setPolicy({ ...policy, maxConcurrentSessions: parseInt(e.target.value) })}
              min="1"
              max="10"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Allowed Email Domains" description="Manage email domains for auto-provisioning and access control">
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddDomain}
              disabled={!newDomain}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Domain
            </button>
          </div>

          <div className="space-y-2">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <Globe className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">{domain.domain}</p>
                    <p className="text-xs text-gray-500">
                      {domain.type === 'whitelist' ? 'Whitelist' : 'Blacklist'}
                      {domain.autoProvision && ' • Auto-provision enabled'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveDomain(domain.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {domains.length === 0 && (
            <div className="text-center py-8 border border-gray-200 rounded-lg">
              <Globe className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No domains configured</p>
              <p className="text-sm text-gray-500 mt-1">Add a domain to control user access</p>
            </div>
          )}
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button
          onClick={handleSavePolicy}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Security Settings'}
        </button>
      </div>
    </div>
  );
};
