/**
 * Integrations Settings Component
 * 
 * Admin UI for managing CRM integrations (HubSpot, Salesforce).
 * Only admins can connect/disconnect; all members can view status.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  crmOAuthService,
  CRMProvider,
  CRMIntegrationsStatus,
  CRMConnectionStatus,
} from '../../services/CRMOAuthService';

// ============================================================================
// Types
// ============================================================================

interface IntegrationsSettingsProps {
  tenantId: string;
  isAdmin: boolean;
}

interface ProviderConfig {
  id: CRMProvider;
  name: string;
  description: string;
  logo: string;
  docsUrl: string;
}

// ============================================================================
// Provider Configuration
// ============================================================================

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Sync deals, contacts, and activities from HubSpot CRM',
    logo: '🟠', // Replace with actual logo
    docsUrl: 'https://developers.hubspot.com/',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Sync opportunities, contacts, and activities from Salesforce',
    logo: '☁️', // Replace with actual logo
    docsUrl: 'https://developer.salesforce.com/',
  },
];

// ============================================================================
// Integration Card Component
// ============================================================================

const IntegrationCard: React.FC<{
  provider: ProviderConfig;
  status: CRMConnectionStatus;
  isAdmin: boolean;
  isLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
}> = ({ provider, status, isAdmin, isLoading, onConnect, onDisconnect, onRefresh }) => {
  const getStatusIcon = () => {
    switch (status.status) {
      case 'active':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'expired':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'error':
      case 'revoked':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <div className="w-5 h-5 rounded-full bg-gray-300" />;
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'active':
        return 'Connected';
      case 'expired':
        return 'Token Expired';
      case 'error':
        return status.error || 'Connection Error';
      case 'revoked':
        return 'Disconnected';
      default:
        return 'Not Connected';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        {/* Provider Info */}
        <div className="flex items-center gap-4">
          <div className="text-3xl">{provider.logo}</div>
          <div>
            <h3 className="font-semibold text-gray-900">{provider.name}</h3>
            <p className="text-sm text-gray-500">{provider.description}</p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${
            status.status === 'active' ? 'text-green-600' :
            status.status === 'expired' ? 'text-yellow-600' :
            status.status === 'error' ? 'text-red-600' :
            'text-gray-500'
          }`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Connection Details */}
      {status.connected && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-500">
              Connected {formatDate(status.connectedAt)}
            </div>
            {status.scopes && (
              <div className="text-gray-400">
                {status.scopes.length} permissions
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-3">
        {status.connected ? (
          <>
            {status.status === 'expired' && isAdmin && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 disabled:opacity-50 transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh Token
              </button>
            )}
            {isAdmin && (
              <button
                onClick={onDisconnect}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
                Disconnect
              </button>
            )}
          </>
        ) : (
          isAdmin && (
            <button
              onClick={onConnect}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              Connect
            </button>
          )
        )}

        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Docs
        </a>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const IntegrationsSettings: React.FC<IntegrationsSettingsProps> = ({
  tenantId,
  isAdmin,
}) => {
  const [status, setStatus] = useState<CRMIntegrationsStatus>({
    hubspot: { connected: false, status: 'not_connected' },
    salesforce: { connected: false, status: 'not_connected' },
  });
  const [loading, setLoading] = useState<CRMProvider | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Fetch status on mount
  const fetchStatus = useCallback(async () => {
    try {
      const result = await crmOAuthService.getStatus(tenantId);
      setStatus(result);
    } finally {
      setIsInitialLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchStatus();

    // Listen for OAuth completion
    const handleOAuthComplete = () => {
      fetchStatus();
    };
    window.addEventListener('crm-oauth-complete', handleOAuthComplete);

    // Check URL for callback status
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') || params.get('error')) {
      fetchStatus();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    return () => {
      window.removeEventListener('crm-oauth-complete', handleOAuthComplete);
    };
  }, [fetchStatus]);

  const handleConnect = async (provider: CRMProvider) => {
    setLoading(provider);
    try {
      await crmOAuthService.connect(provider, tenantId);
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async (provider: CRMProvider) => {
    if (!confirm(`Are you sure you want to disconnect ${provider}?`)) {
      return;
    }

    setLoading(provider);
    try {
      await crmOAuthService.disconnect(provider, tenantId);
      await fetchStatus();
    } finally {
      setLoading(null);
    }
  };

  const handleRefresh = async (provider: CRMProvider) => {
    setLoading(provider);
    try {
      await crmOAuthService.refreshTokens(provider, tenantId);
      await fetchStatus();
    } finally {
      setLoading(null);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">CRM Integrations</h2>
        <p className="text-sm text-gray-500 mt-1">
          Connect your CRM to automatically sync deals, contacts, and activities.
          {!isAdmin && ' Contact an admin to manage connections.'}
        </p>
      </div>

      {/* Integration Cards */}
      <div className="grid gap-4">
        {PROVIDERS.map(provider => (
          <IntegrationCard
            key={provider.id}
            provider={provider}
            status={status[provider.id]}
            isAdmin={isAdmin}
            isLoading={loading === provider.id}
            onConnect={() => handleConnect(provider.id)}
            onDisconnect={() => handleDisconnect(provider.id)}
            onRefresh={() => handleRefresh(provider.id)}
          />
        ))}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">How it works</p>
            <ul className="mt-1 space-y-1 text-blue-600">
              <li>• Connect once, all team members can access CRM data</li>
              <li>• AI automatically queries your CRM when relevant</li>
              <li>• Value insights can be synced back to your CRM</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsSettings;
