import React, { useState } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { SettingsDangerZone } from '../../components/Settings/SettingsDangerZone';
import {
  Shield, Smartphone, Monitor, Copy, Check, Eye, EyeOff,
  AlertCircle, Loader2, QrCode, Download, RefreshCw, MapPin
} from 'lucide-react';
import { defaultPasswordPolicy, validatePassword } from '../../utils/security';

interface PasswordStrength {
  score: number;
  feedback: string;
  color: string;
}

interface Session {
  id: string;
  deviceType: 'desktop' | 'mobile';
  browser: string;
  os: string;
  location: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

export const UserSecurity: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [generatingCodes, setGeneratingCodes] = useState(false);

  const [sessions] = useState<Session[]>([
    {
      id: '1',
      deviceType: 'desktop',
      browser: 'Chrome 120',
      os: 'macOS 14.0',
      location: 'San Francisco, CA',
      ipAddress: '192.168.1.1',
      lastActive: 'Just now',
      isCurrent: true,
    },
    {
      id: '2',
      deviceType: 'mobile',
      browser: 'Safari Mobile',
      os: 'iOS 17.2',
      location: 'San Francisco, CA',
      ipAddress: '192.168.1.50',
      lastActive: '2 hours ago',
      isCurrent: false,
    },
  ]);

  const calculatePasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    if (password.length >= defaultPasswordPolicy.minLength) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;
    if (password.length >= defaultPasswordPolicy.minLength + 4) score++;

    if (score <= 2) return { score, feedback: 'Weak', color: 'bg-red-500' };
    if (score === 3) return { score, feedback: 'Fair', color: 'bg-yellow-500' };
    if (score === 4) return { score, feedback: 'Good', color: 'bg-blue-500' };
    return { score, feedback: 'Strong', color: 'bg-green-500' };
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setPasswordError(validation.errors[0]);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    const strength = calculatePasswordStrength(newPassword);
    if (strength.score < 4) {
      setPasswordError('Please choose a stronger password');
      return;
    }

    setChangingPassword(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error) {
      setPasswordError('Failed to change password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleGenerateBackupCodes = async () => {
    setGeneratingCodes(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const codes = Array.from({ length: 8 }, () =>
        Math.random().toString(36).substr(2, 4).toUpperCase() + '-' +
        Math.random().toString(36).substr(2, 4).toUpperCase()
      );
      setBackupCodes(codes);
    } finally {
      setGeneratingCodes(false);
    }
  };

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadBackupCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogoutSession = async (sessionId: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    logger.debug('Logged out session:', sessionId);
  };

  const handleLogoutAllSessions = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    logger.debug('Logged out all sessions');
  };

  const passwordStrength = newPassword ? calculatePasswordStrength(newPassword) : null;

  const getDeviceIcon = (deviceType: string) => {
    return deviceType === 'mobile' ? (
      <Smartphone className="h-6 w-6 text-gray-600" />
    ) : (
      <Monitor className="h-6 w-6 text-gray-600" />
    );
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Password"
        description="Update your password regularly to keep your account secure"
      >
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Current Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showPasswords.current ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.current ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPasswords.new ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.new ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {passwordStrength && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Password strength:</span>
                  <span className="font-medium">{passwordStrength.feedback}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Password Requirements:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-start">
                <Check className={`h-4 w-4 mr-2 mt-0.5 ${newPassword.length >= defaultPasswordPolicy.minLength ? 'text-green-600' : 'text-gray-400'}`} />
                At least {defaultPasswordPolicy.minLength} characters
              </li>
              <li className="flex items-start">
                <Check className={`h-4 w-4 mr-2 mt-0.5 ${/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}`} />
                Mix of uppercase and lowercase
              </li>
              <li className="flex items-start">
                <Check className={`h-4 w-4 mr-2 mt-0.5 ${/\d/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}`} />
                At least one number
              </li>
              <li className="flex items-start">
                <Check className={`h-4 w-4 mr-2 mt-0.5 ${/[^a-zA-Z\d]/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}`} />
                At least one special character
              </li>
            </ul>
          </div>

          {passwordError && (
            <div className="flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center text-sm text-green-600 bg-green-50 p-3 rounded-lg">
              <Check className="h-4 w-4 mr-2 flex-shrink-0" />
              Password changed successfully
            </div>
          )}

          <button
            type="submit"
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {changingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Two-Factor Authentication"
        description="Add an extra layer of security to your account"
      >
        {mfaEnabled && !showMfaSetup ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-start space-x-3">
                <Shield className="h-6 w-6 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">2FA is enabled</p>
                  <p className="text-sm text-gray-600 mt-1">Your account is protected with authenticator app</p>
                  <p className="text-xs text-gray-500 mt-2">Enabled on Nov 10, 2024</p>
                </div>
              </div>
              <button
                onClick={() => setMfaEnabled(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Disable
              </button>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Backup Codes</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Use these codes if you lose access to your authenticator app
                  </p>
                </div>
                <button
                  onClick={handleGenerateBackupCodes}
                  disabled={generatingCodes}
                  className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {generatingCodes ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Generate New Codes
                </button>
              </div>

              {backupCodes.length > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-900">Your Backup Codes</p>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleCopyBackupCodes}
                        className="flex items-center px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors"
                      >
                        {copiedCode ? <Check className="h-4 w-4 mr-1.5 text-green-600" /> : <Copy className="h-4 w-4 mr-1.5" />}
                        {copiedCode ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={handleDownloadBackupCodes}
                        className="flex items-center px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors"
                      >
                        <Download className="h-4 w-4 mr-1.5" />
                        Download
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="px-3 py-2 bg-white border border-gray-200 rounded">
                        {code}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-3">
                    Store these codes in a safe place. Each code can only be used once.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : !mfaEnabled ? (
          <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">2FA is not enabled</p>
                <p className="text-sm text-gray-600 mt-1">Enable two-factor authentication for better security</p>
              </div>
            </div>
            <button
              onClick={() => setShowMfaSetup(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Enable 2FA
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-48 h-48 bg-white border-4 border-gray-300 rounded-lg mb-4">
                <QrCode className="h-32 w-32 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              <div className="inline-block px-4 py-2 bg-gray-100 border border-gray-300 rounded font-mono text-sm">
                ABCD-EFGH-IJKL-MNOP
              </div>
              <p className="text-xs text-gray-500 mt-2">Or enter this code manually</p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowMfaSetup(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setMfaEnabled(true);
                  setShowMfaSetup(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Verify & Enable
              </button>
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Active Sessions"
        description="Manage devices where you're currently logged in"
      >
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-start justify-between p-4 border rounded-lg ${
                session.isCurrent ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start space-x-3 flex-1">
                {getDeviceIcon(session.deviceType)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="font-medium text-gray-900">{session.browser}</p>
                    {session.isCurrent && (
                      <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{session.os}</p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      {session.location}
                    </span>
                    <span>{session.ipAddress}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Last active: {session.lastActive}</p>
                </div>
              </div>
              {!session.isCurrent && (
                <button
                  onClick={() => handleLogoutSession(session.id)}
                  className="ml-4 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Log out
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={handleLogoutAllSessions}
            className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Log out all other sessions
          </button>
          <p className="text-sm text-gray-600 mt-2">
            This will log you out of all devices except this one
          </p>
        </div>
      </SettingsSection>

      <SettingsDangerZone
        actions={[
          {
            label: 'Revoke All Sessions',
            description: 'Log out from all devices and require re-authentication everywhere.',
            buttonText: 'Revoke All',
            confirmText: 'REVOKE',
            onConfirm: async () => {
              await new Promise(resolve => setTimeout(resolve, 1000));
              logger.debug('All sessions revoked');
            },
          },
        ]}
      />
    </div>
  );
};
