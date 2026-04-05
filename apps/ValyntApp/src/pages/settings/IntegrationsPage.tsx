/**
 * IntegrationsPage - Connected apps and integrations
 */

import { formatDistanceToNow } from "date-fns";
import { Check, ExternalLink, RefreshCw, Settings2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { SettingsAlert, SettingsSection } from "@/components/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIntegrations } from "@/integrations";
import type {
  IntegrationCapabilityKey,
  IntegrationConfigField,
  IntegrationConnection,
  IntegrationCredentialsInput,
  IntegrationOperationEntry,
  IntegrationProvider,
} from "@/integrations/types";
import { INTEGRATION_CAPABILITY_META } from "@/integrations/types";

const statusBadge = (status: IntegrationConnection["status"]) => {
  switch (status) {
    case "connected":
      return { label: "Connected", className: "bg-emerald-100 text-emerald-700" };
    case "error":
      return { label: "Error", className: "bg-rose-100 text-rose-700" };
    case "pending":
      return { label: "Pending", className: "bg-amber-100 text-amber-700" };
    default:
      return { label: "Disconnected", className: "bg-slate-100 text-slate-600" };
  }
};

const formatTimestamp = (value?: string) => {
  if (!value) return "Never";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
};

const getConnectLabel = (provider: IntegrationProvider) => `Connect with ${provider.name}`;
const getReconnectLabel = (provider: IntegrationProvider) => `Reconnect ${provider.name}`;
const ACTION_CAPABILITY_REQUIREMENTS: Array<{
  key: IntegrationCapabilityKey;
  action: string;
  unsupportedText: string;
}> = [
  {
    key: "manualSync",
    action: "Sync",
    unsupportedText: "Manual sync is not available for this provider.",
  },
];

export function IntegrationsPage() {
  const {
    integrations,
    providers,
    isLoading,
    error,
    oauthInProgressProvider,
    fetchIntegrations,
    connect,
    disconnect,
    testConnection,
    sync,
    operations,
    fetchOperations,
    replayWebhookFailure,
    retrySyncFailure,
  } = useIntegrations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<IntegrationProvider | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [actionProvider, setActionProvider] = useState<string | null>(null);
  const [subview, setSubview] = useState<"connections" | "operations">("connections");

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  useEffect(() => {
    if (subview === "operations") {
      void fetchOperations();
    }
  }, [fetchOperations, subview]);

  const integrationMap = useMemo(() => {
    return new Map(integrations.map((item) => [item.provider, item]));
  }, [integrations]);

  const oauthProviders = useMemo(
    () => providers.filter((provider) => provider.capabilities.oauth),
    [providers]
  );
  const manualProviders = useMemo(
    () => providers.filter((provider) => !provider.capabilities.oauth),
    [providers]
  );

  const openDialog = (provider: IntegrationProvider) => {
    setActiveProvider(provider);
    setFormValues({});
    setFormError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setActiveProvider(null);
    setFormError(null);
    setFormValues({});
  };

  const onFieldChange = (field: IntegrationConfigField, value: string) => {
    setFormValues((prev) => ({ ...prev, [field.key]: value }));
  };

  const validateForm = (provider: IntegrationProvider): IntegrationCredentialsInput | null => {
    const errors: string[] = [];
    provider.fields.forEach((field) => {
      if (field.required && !formValues[field.key]?.trim()) {
        errors.push(`${field.label} is required`);
      }
    });

    if (errors.length > 0) {
      setFormError(errors[0]);
      return null;
    }

    const payload: IntegrationCredentialsInput = {
      accessToken: formValues.accessToken?.trim() || undefined,
      refreshToken: formValues.refreshToken?.trim() || undefined,
      instanceUrl: formValues.instanceUrl?.trim() || undefined,
    };

    return payload;
  };

  const handleConnect = async () => {
    if (!activeProvider) return;
    const payload = validateForm(activeProvider);
    if (!payload) return;

    setActionProvider(activeProvider.id);
    try {
      await connect(activeProvider.id, payload);
      closeDialog();
    } finally {
      setActionProvider(null);
    }
  };

  const handleOAuthConnect = async (provider: IntegrationProvider) => {
    setActionProvider(provider.id);
    try {
      await connect(provider.id);
    } finally {
      setActionProvider(null);
    }
  };

  const handleDisconnect = async (integration: IntegrationConnection) => {
    setActionProvider(integration.provider);
    try {
      await disconnect(integration.id);
    } finally {
      setActionProvider(null);
    }
  };

  const handleTest = async (integration: IntegrationConnection) => {
    setActionProvider(integration.provider);
    try {
      await testConnection(integration.id);
    } finally {
      setActionProvider(null);
    }
  };

  const handleSync = async (integration: IntegrationConnection) => {
    setActionProvider(integration.provider);
    try {
      await sync(integration.id);
    } finally {
      setActionProvider(null);
    }
  };

  const IntegrationCard = ({ provider }: { provider: IntegrationProvider }) => {
    const connection = integrationMap.get(provider.id);
    const status = connection?.status ?? "disconnected";
    const badge = statusBadge(status);
    const hasActiveConnection = !!connection && status !== "disconnected";
    const isOAuth = provider.capabilities.oauth;
    const capabilitySummary = (Object.keys(INTEGRATION_CAPABILITY_META) as IntegrationCapabilityKey[])
      .map((key) => ({
        key,
        supported: provider.capabilities[key],
        ...INTEGRATION_CAPABILITY_META[key],
      }));
    const unsupportedCapabilities = capabilitySummary.filter((item) => !item.supported);
    const unsupportedActions = ACTION_CAPABILITY_REQUIREMENTS
      .map((entry) => ({
        ...entry,
        supported: provider.capabilities[entry.key],
      }))
      .filter((entry) => !entry.supported);

    const StatusIcon = status === "connected" ? Check : XCircle;

    return (
      <div className="flex items-center justify-between gap-4 p-4 border-b border-border last:border-b-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
            {provider.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{provider.name}</p>
              <Badge variant="secondary" className={`${badge.className} text-xs`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {badge.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{provider.description}</p>
            {hasActiveConnection && connection?.lastSyncAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Last sync {formatTimestamp(connection.lastSyncAt)}
              </p>
            )}
            {hasActiveConnection && connection?.errorMessage && status === "error" && (
              <p className="text-xs text-rose-600 mt-1">{connection.errorMessage}</p>
            )}
            {unsupportedCapabilities.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Unsupported: {unsupportedCapabilities.map((entry) => entry.label).join(", ")}.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveConnection ? (
            <>
              {!isOAuth && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDialog(provider)}
                  disabled={actionProvider === provider.id}
                >
                  <Settings2 className="h-3 w-3 mr-2" />
                  Configure
                </Button>
              )}
              {isOAuth && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOAuthConnect(provider)}
                  disabled={actionProvider === provider.id || oauthInProgressProvider === provider.id}
                >
                  <ExternalLink className="h-3 w-3 mr-2" />
                  {getReconnectLabel(provider)}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleTest(connection)}
                disabled={actionProvider === provider.id || oauthInProgressProvider === provider.id}
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Test
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSync(connection)}
                disabled={
                  !provider.capabilities.manualSync ||
                  actionProvider === provider.id ||
                  oauthInProgressProvider === provider.id
                }
                title={
                  !provider.capabilities.manualSync
                    ? INTEGRATION_CAPABILITY_META.manualSync.unsupportedText
                    : undefined
                }
              >
                Sync
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDisconnect(connection)}
                disabled={actionProvider === provider.id || oauthInProgressProvider === provider.id}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                provider.capabilities.oauth ? handleOAuthConnect(provider) : openDialog(provider)
              }
              disabled={actionProvider === provider.id || oauthInProgressProvider === provider.id}
            >
              {oauthInProgressProvider === provider.id ? "Connecting..." : getConnectLabel(provider)}
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          )}
          {unsupportedActions.map((entry) => (
            <span key={`${provider.id}-${entry.action}`} className="text-xs text-muted-foreground">
              {entry.action} unavailable — {entry.unsupportedText}
            </span>
          ))}
          {!hasActiveConnection && !provider.capabilities.oauth && provider.fields.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Manual setup is not available for this provider yet.
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  const renderOperationRow = (
    entry: IntegrationOperationEntry,
    controls?: ReactNode
  ) => (
    <div key={entry.id} className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="uppercase text-[10px] tracking-wide">
            {entry.provider}
          </Badge>
          <span className="text-sm font-medium">{entry.action}</span>
          <Badge
            variant="secondary"
            className={
              entry.status === "failed"
                ? "bg-rose-100 text-rose-700"
                : "bg-emerald-100 text-emerald-700"
            }
          >
            {entry.status}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Correlation ID: {entry.correlationId ?? "n/a"}
      </div>
      {controls ? <div className="flex justify-end">{controls}</div> : null}
    </div>
  );

  return (
    <div>
      {error && (
        <SettingsAlert
          type="error"
          title="Integrations error"
          description={error}
          action={{
            label: "Retry",
            onClick: () => fetchIntegrations(),
          }}
        />
      )}

      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={subview === "connections" ? "default" : "outline"}
          size="sm"
          onClick={() => setSubview("connections")}
        >
          Connections
        </Button>
        <Button
          variant={subview === "operations" ? "default" : "outline"}
          size="sm"
          onClick={() => setSubview("operations")}
        >
          Operations
        </Button>
      </div>

      {subview === "connections" ? (
        <>
          <SettingsSection
            title="CRM"
            description="Connect your CRM to sync opportunities and contacts"
          >
            {oauthProviders.map((provider) => (
              <IntegrationCard key={provider.id} provider={provider} />
            ))}
          </SettingsSection>

          <SettingsSection
            title="Manual Credentials"
            description="Manage integrations that require manually entered credentials."
          >
            {manualProviders.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No manual credential integrations are currently configured.
              </p>
            ) : (
              manualProviders.map((provider) => (
                <IntegrationCard key={provider.id} provider={provider} />
              ))
            )}
          </SettingsSection>
        </>
      ) : (
        <>
          <SettingsSection
            title="Connection Events"
            description="Recent integration connection lifecycle events."
          >
            {operations.connectionEvents.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No connection events found.</p>
            ) : (
              operations.connectionEvents.map((entry) => renderOperationRow(entry))
            )}
          </SettingsSection>

          <SettingsSection
            title="Webhook Failures"
            description="Failed webhook jobs with replay controls for support and SRE."
          >
            {operations.webhookFailures.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No webhook failures found.</p>
            ) : (
              operations.webhookFailures.map((entry) =>
                renderOperationRow(
                  entry,
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await replayWebhookFailure(entry.id);
                      await fetchOperations();
                    }}
                  >
                    Replay webhook
                  </Button>
                )
              )
            )}
          </SettingsSection>

          <SettingsSection
            title="Sync Failures"
            description="Failed sync operations with retry controls."
          >
            {operations.syncFailures.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No sync failures found.</p>
            ) : (
              operations.syncFailures.map((entry) =>
                renderOperationRow(
                  entry,
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await retrySyncFailure(entry.provider);
                      await fetchOperations();
                    }}
                  >
                    Retry sync
                  </Button>
                )
              )
            )}
          </SettingsSection>

          <SettingsSection
            title="Reauth / Disable / Disconnect History"
            description="Auth and connection-state transitions across providers."
          >
            {operations.lifecycleHistory.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No lifecycle history found.</p>
            ) : (
              operations.lifecycleHistory.map((entry) => renderOperationRow(entry))
            )}
          </SettingsSection>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {activeProvider ? getConnectLabel(activeProvider) : "Connect integration"}
            </DialogTitle>
            <DialogDescription>
              Enter credentials for the selected provider.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {activeProvider?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={formValues[field.key] || ""}
                  onChange={(event) => onFieldChange(field, event.target.value)}
                />
                {field.helperText && (
                  <p className="text-xs text-muted-foreground">{field.helperText}</p>
                )}
              </div>
            ))}
            {formError && <p className="text-sm text-rose-600">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={!!actionProvider || isLoading}>
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default IntegrationsPage;
