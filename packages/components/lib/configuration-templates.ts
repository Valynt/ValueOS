export interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  category: "startup" | "enterprise" | "development" | "production";
  configuration: {
    organization: Record<string, unknown>;
    ai: Record<string, unknown>;
  };
}

export const configurationTemplates: ConfigurationTemplate[] = [
  {
    id: "startup",
    name: "Startup",
    description: "Cost-optimized settings for startups and small teams",
    category: "startup",
    configuration: {
      organization: { tenantProvisioning: { maxUsers: 25, maxStorageGB: 100 } },
      ai: {
        llmSpendingLimits: { monthlyHardCap: 500 },
        modelRouting: { defaultModel: "gpt-3.5-turbo" },
      },
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Full-featured configuration for large organizations",
    category: "enterprise",
    configuration: {
      organization: { tenantProvisioning: { maxUsers: 500, maxStorageGB: 5000 } },
      ai: {
        llmSpendingLimits: { monthlyHardCap: 10000 },
        modelRouting: { defaultModel: "gpt-4" },
      },
    },
  },
  {
    id: "development",
    name: "Development",
    description: "Permissive settings for testing and development",
    category: "development",
    configuration: {
      organization: { tenantProvisioning: { maxUsers: 10, maxStorageGB: 50 } },
      ai: {
        llmSpendingLimits: { monthlyHardCap: 100 },
        modelRouting: { defaultModel: "gpt-3.5-turbo" },
      },
    },
  },
  {
    id: "production",
    name: "Production",
    description: "Strict, secure settings for production environments",
    category: "production",
    configuration: {
      organization: { tenantProvisioning: { maxUsers: 200, maxStorageGB: 2000 } },
      ai: {
        llmSpendingLimits: { monthlyHardCap: 5000 },
        modelRouting: { defaultModel: "gpt-4" },
      },
    },
  },
];
