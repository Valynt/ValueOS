/**
 * Organization Settings Component
 * 
 * UI for managing organization-level configurations
 */

'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ValidatedInput } from '@/components/ui/validated-input';
import { configValidation } from '@/lib/validation/configValidation';


interface OrganizationSettingsProps {
  settings: Record<string, unknown>;
  onUpdate: (setting: string, value: unknown) => void;
  userRole: 'tenant_admin' | 'vendor_admin';
  saving: boolean;
  searchQuery?: string;
  searchInValues?: boolean;
  bulkEditMode?: boolean;
  selectedSettings?: Set<string>;
  onToggleSelection?: (path: string) => void;
}

export function OrganizationSettings({
  settings,
  onUpdate,
  userRole,
  saving,
  searchQuery = '',
  searchInValues = false,
  bulkEditMode = false,
  selectedSettings = new Set(),
  onToggleSelection
}: OrganizationSettingsProps) {
  const [tenantProvisioning, setTenantProvisioning] = useState(
    settings.tenantProvisioning
  );
  const [customBranding, setCustomBranding] = useState(settings.customBranding || {});
  const [dataResidency, setDataResidency] = useState(settings.dataResidency);
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Filter sections based on search query
  const matchesSearch = (text: string, values?: unknown) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const textMatch = text.toLowerCase().includes(query);
    
    if (!searchInValues || !values) return textMatch;
    
    // Also search in values
    const valueString = JSON.stringify(values).toLowerCase();
    return textMatch || valueString.includes(query);
  };

  const showTenantProvisioning = matchesSearch(
    'tenant provisioning status users storage',
    tenantProvisioning
  );
  const showCustomBranding = matchesSearch(
    'custom branding logo color font theme',
    customBranding
  );
  const showDataResidency = matchesSearch(
    'data residency region compliance gdpr iso27001',
    dataResidency
  );

  // Auto-save on change with validation
  const handleTenantProvisioningChange = (updates: Partial<typeof tenantProvisioning>) => {
    const updated = { ...tenantProvisioning, ...updates };
    
    // Validate changes
    const errors: Record<string, string> = {};
    if (updates.maxUsers !== undefined) {
      const result = configValidation.maxUsers(updates.maxUsers);
      if (!result.valid && result.error) {
        errors.maxUsers = result.error;
      }
    }
    if (updates.maxStorageGB !== undefined) {
      const result = configValidation.maxStorageGB(updates.maxStorageGB);
      if (!result.valid && result.error) {
        errors.maxStorageGB = result.error;
      }
    }
    
    setValidationErrors(prev => ({ ...prev, ...errors }));
    
    // Only save if valid
    if (Object.keys(errors).length === 0) {
      setTenantProvisioning(updated);
      onUpdate('tenant_provisioning', updated);
    }
  };

  const handleCustomBrandingChange = (updates: Partial<typeof customBranding>) => {
    const updated = { ...customBranding, ...updates };
    
    // Validate changes
    const errors: Record<string, string> = {};
    if (updates.logoUrl !== undefined) {
      const result = configValidation.logoUrl(updates.logoUrl);
      if (!result.valid && result.error) {
        errors.logoUrl = result.error;
      }
    }
    if (updates.primaryColor !== undefined) {
      const result = configValidation.primaryColor(updates.primaryColor);
      if (!result.valid && result.error) {
        errors.primaryColor = result.error;
      }
    }
    
    setValidationErrors(prev => ({ ...prev, ...errors }));
    
    // Only save if valid
    if (Object.keys(errors).length === 0) {
      setCustomBranding(updated);
      onUpdate('custom_branding', updated);
    }
  };

  const handleDataResidencyChange = (updates: Partial<typeof dataResidency>) => {
    const updated = { ...dataResidency, ...updates };
    setDataResidency(updated);
    onUpdate('data_residency', updated);
  };

  return (
    <div className="space-y-6">
      {/* Tenant Provisioning */}
      {showTenantProvisioning && (
      <Card id="tenant_provisioning">
        <CardHeader>
          <div className="flex items-center gap-2">
            {bulkEditMode && onToggleSelection && (
              <Checkbox
                checked={selectedSettings.has('organization.tenant_provisioning')}
                onCheckedChange={() => onToggleSelection('organization.tenant_provisioning')}
              />
            )}
            <CardTitle>Tenant Provisioning</CardTitle>
            <HelpTooltip content="Control tenant status, user limits, and storage quotas. Changes take effect immediately." />
          </div>
          <CardDescription>
            Manage tenant lifecycle and resource limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={tenantProvisioning.status}
                onValueChange={(value) =>
                  handleTenantProvisioningChange({ status: value })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deprovisioned">Deprovisioned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <ValidatedInput
                label="Max Users"
                id="maxUsers"
                type="number"
                value={tenantProvisioning.maxUsers}
                onChange={(e) =>
                  handleTenantProvisioningChange({
                    maxUsers: parseInt(e.target.value) || 0
                  })
                }
                error={validationErrors.maxUsers}
                valid={!validationErrors.maxUsers && tenantProvisioning.maxUsers > 0}
                helperText="Maximum number of users allowed"
              />
            </div>

            <div>
              <ValidatedInput
                label="Max Storage (GB)"
                id="maxStorage"
                type="number"
                value={tenantProvisioning.maxStorageGB}
                onChange={(e) =>
                  handleTenantProvisioningChange({
                    maxStorageGB: parseInt(e.target.value) || 0
                  })
                }
                error={validationErrors.maxStorageGB}
                valid={!validationErrors.maxStorageGB && tenantProvisioning.maxStorageGB > 0}
                helperText="Maximum storage in gigabytes"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Custom Branding */}
      {showCustomBranding && (
      <Card id="custom_branding">
        <CardHeader>
          <div className="flex items-center gap-2">
            {bulkEditMode && onToggleSelection && (
              <Checkbox
                checked={selectedSettings.has('organization.custom_branding')}
                onCheckedChange={() => onToggleSelection('organization.custom_branding')}
              />
            )}
            <CardTitle>Custom Branding</CardTitle>
            <HelpTooltip content="Personalize your organization's appearance with custom logos, colors, and fonts. Changes apply to all users." />
          </div>
          <CardDescription>
            Customize organization appearance and theme
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <ValidatedInput
                label="Logo URL"
                id="logoUrl"
                type="url"
                value={customBranding.logoUrl || ''}
                onChange={(e) =>
                  handleCustomBrandingChange({ logoUrl: e.target.value })
                }
                placeholder="https://example.com/logo.png"
                error={validationErrors.logoUrl}
                valid={!validationErrors.logoUrl && customBranding.logoUrl}
                helperText="URL to your organization's logo"
              />
            </div>

            <div>
              <ValidatedInput
                label="Primary Color"
                id="primaryColor"
                type="text"
                value={customBranding.primaryColor || ''}
                onChange={(e) =>
                  handleCustomBrandingChange({ primaryColor: e.target.value })
                }
                placeholder="#FF5733"
                error={validationErrors.primaryColor}
                valid={!validationErrors.primaryColor && customBranding.primaryColor}
                helperText="Hex color code (e.g., #FF5733)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <Input
                id="secondaryColor"
                type="color"
                value={customBranding.secondaryColor || '#ffffff'}
                onChange={(e) =>
                  handleCustomBrandingChange({ secondaryColor: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fontFamily">Font Family</Label>
              <Input
                id="fontFamily"
                value={customBranding.fontFamily || ''}
                onChange={(e) =>
                  handleCustomBrandingChange({ fontFamily: e.target.value })
                }
                placeholder="Inter, sans-serif"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Data Residency */}
      {showDataResidency && (
      <Card id="data_residency">
        <CardHeader>
          <div className="flex items-center gap-2">
            {bulkEditMode && onToggleSelection && (
              <Checkbox
                checked={selectedSettings.has('organization.data_residency')}
                onCheckedChange={() => onToggleSelection('organization.data_residency')}
              />
            )}
            <CardTitle>Data Residency</CardTitle>
            <HelpTooltip content="Select where your data is stored and which compliance standards to meet. Changing regions may require data migration." />
          </div>
          <CardDescription>
            Configure geographic data storage and compliance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="primaryRegion">Primary Region</Label>
            <Select
              value={dataResidency.primaryRegion}
              onValueChange={(value) =>
                handleDataResidencyChange({ primaryRegion: value })
              }
            >
              <SelectTrigger id="primaryRegion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                <SelectItem value="ap-northeast-1">Asia Pacific (Tokyo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Compliance Requirements</Label>
            <div className="flex flex-wrap gap-2">
              {['GDPR', 'ISO27001', 'SOC2', 'ISO27001'].map((req) => (
                <Badge
                  key={req}
                  variant={
                    dataResidency.complianceRequirements?.includes(req)
                      ? 'default'
                      : 'outline'
                  }
                  className="cursor-pointer"
                  onClick={() => {
                    const current = dataResidency.complianceRequirements || [];
                    const updated = current.includes(req)
                      ? current.filter((r: string) => r !== req)
                      : [...current, req];
                    handleDataResidencyChange({ complianceRequirements: updated });
                  }}
                >
                  {req}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {!showTenantProvisioning && !showCustomBranding && !showDataResidency && searchQuery && (
        <div className="text-center py-12 text-muted-foreground">
          No settings match "{searchQuery}"
        </div>
      )}
    </div>
  );
}
