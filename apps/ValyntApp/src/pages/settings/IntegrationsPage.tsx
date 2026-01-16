/**
 * IntegrationsPage - Connected apps and integrations
 */

import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsSection } from "@/components/settings";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  category: "crm" | "communication" | "storage" | "analytics";
}

const INTEGRATIONS: Integration[] = [
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Sync opportunities and contacts",
    icon: "SF",
    connected: true,
    category: "crm",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Import deals and company data",
    icon: "HS",
    connected: false,
    category: "crm",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get notifications in your workspace",
    icon: "SL",
    connected: true,
    category: "communication",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Share updates with your team",
    icon: "MT",
    connected: false,
    category: "communication",
  },
  {
    id: "gdrive",
    name: "Google Drive",
    description: "Store and share documents",
    icon: "GD",
    connected: false,
    category: "storage",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Sync files and attachments",
    icon: "DB",
    connected: false,
    category: "storage",
  },
];

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);

  const handleToggle = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i))
    );
  };

  const crmIntegrations = integrations.filter((i) => i.category === "crm");
  const commIntegrations = integrations.filter((i) => i.category === "communication");
  const storageIntegrations = integrations.filter((i) => i.category === "storage");

  const IntegrationCard = ({ integration }: { integration: Integration }) => (
    <div className="flex items-center justify-between p-4 border-b border-border last:border-b-0">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
          {integration.icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{integration.name}</p>
            {integration.connected && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                <Check className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{integration.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {integration.connected ? (
          <>
            <Button variant="ghost" size="sm">
              Configure
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => handleToggle(integration.id)}
            >
              Disconnect
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => handleToggle(integration.id)}>
            Connect
            <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* CRM */}
      <SettingsSection
        title="CRM"
        description="Connect your CRM to sync opportunities and contacts"
      >
        {crmIntegrations.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </SettingsSection>

      {/* Communication */}
      <SettingsSection
        title="Communication"
        description="Get notifications where your team works"
      >
        {commIntegrations.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </SettingsSection>

      {/* Storage */}
      <SettingsSection
        title="File storage"
        description="Connect cloud storage for documents"
      >
        {storageIntegrations.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </SettingsSection>
    </div>
  );
}

export default IntegrationsPage;
