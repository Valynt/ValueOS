/**
 * Configuration Templates
 * 
 * Pre-defined configuration templates for quick setup
 */

export interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'startup' | 'enterprise' | 'development' | 'production';
  configuration: {
    organization: any;
    ai: any;
  };
}

export const configurationTemplates: ConfigurationTemplate[] = [
  {
    id: 'startup',
    name: 'Startup',
    description: 'Cost-optimized settings for startups and small teams',
    category: 'startup',
    configuration: {
      organization: {
        tenantProvisioning: {
          status: 'active',
          maxUsers: 25,
          maxStorageGB: 100
        },
        customBranding: {
          logoUrl: '',
          primaryColor: '#3B82F6',
          secondaryColor: '#10B981',
          fontFamily: 'Inter, sans-serif'
        },
        dataResidency: {
          primaryRegion: 'us-east-1',
          complianceRequirements: []
        }
      },
      ai: {
        llmSpendingLimits: {
          monthlyHardCap: 500,
          monthlySoftCap: 400,
          perRequestLimit: 1.0,
          alertThreshold: 80
        },
        modelRouting: {
          defaultModel: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 2000
        },
        agentToggles: {
          enabledAgents: {
            causalAnalysis: true,
            biasDetection: true,
            valueMapping: true,
            stakeholderAnalysis: false
          }
        },
        hitlThresholds: {
          minConfidence: 70,
          maxConfidence: 95,
          autoRejectBelow: 50
        }
      }
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Full-featured configuration for large organizations',
    category: 'enterprise',
    configuration: {
      organization: {
        tenantProvisioning: {
          status: 'active',
          maxUsers: 500,
          maxStorageGB: 5000
        },
        customBranding: {
          logoUrl: '',
          primaryColor: '#1E40AF',
          secondaryColor: '#059669',
          fontFamily: 'Inter, sans-serif'
        },
        dataResidency: {
          primaryRegion: 'us-east-1',
          complianceRequirements: ['GDPR', 'SOC2', 'ISO27001']
        }
      },
      ai: {
        llmSpendingLimits: {
          monthlyHardCap: 10000,
          monthlySoftCap: 8000,
          perRequestLimit: 5.0,
          alertThreshold: 75
        },
        modelRouting: {
          defaultModel: 'gpt-4',
          temperature: 0.5,
          maxTokens: 4000
        },
        agentToggles: {
          enabledAgents: {
            causalAnalysis: true,
            biasDetection: true,
            valueMapping: true,
            stakeholderAnalysis: true
          }
        },
        hitlThresholds: {
          minConfidence: 80,
          maxConfidence: 98,
          autoRejectBelow: 60
        }
      }
    }
  },
  {
    id: 'development',
    name: 'Development',
    description: 'Permissive settings for testing and development',
    category: 'development',
    configuration: {
      organization: {
        tenantProvisioning: {
          status: 'trial',
          maxUsers: 10,
          maxStorageGB: 50
        },
        customBranding: {
          logoUrl: '',
          primaryColor: '#8B5CF6',
          secondaryColor: '#EC4899',
          fontFamily: 'Inter, sans-serif'
        },
        dataResidency: {
          primaryRegion: 'us-west-2',
          complianceRequirements: []
        }
      },
      ai: {
        llmSpendingLimits: {
          monthlyHardCap: 100,
          monthlySoftCap: 80,
          perRequestLimit: 0.5,
          alertThreshold: 90
        },
        modelRouting: {
          defaultModel: 'gpt-3.5-turbo',
          temperature: 0.9,
          maxTokens: 1000
        },
        agentToggles: {
          enabledAgents: {
            causalAnalysis: true,
            biasDetection: true,
            valueMapping: true,
            stakeholderAnalysis: true
          }
        },
        hitlThresholds: {
          minConfidence: 50,
          maxConfidence: 90,
          autoRejectBelow: 30
        }
      }
    }
  },
  {
    id: 'production',
    name: 'Production',
    description: 'Strict, secure settings for production environments',
    category: 'production',
    configuration: {
      organization: {
        tenantProvisioning: {
          status: 'active',
          maxUsers: 200,
          maxStorageGB: 2000
        },
        customBranding: {
          logoUrl: '',
          primaryColor: '#DC2626',
          secondaryColor: '#EA580C',
          fontFamily: 'Inter, sans-serif'
        },
        dataResidency: {
          primaryRegion: 'us-east-1',
          complianceRequirements: ['GDPR', 'HIPAA', 'SOC2']
        }
      },
      ai: {
        llmSpendingLimits: {
          monthlyHardCap: 5000,
          monthlySoftCap: 4000,
          perRequestLimit: 2.0,
          alertThreshold: 70
        },
        modelRouting: {
          defaultModel: 'gpt-4',
          temperature: 0.3,
          maxTokens: 3000
        },
        agentToggles: {
          enabledAgents: {
            causalAnalysis: true,
            biasDetection: true,
            valueMapping: true,
            stakeholderAnalysis: true
          }
        },
        hitlThresholds: {
          minConfidence: 85,
          maxConfidence: 99,
          autoRejectBelow: 70
        }
      }
    }
  }
];
