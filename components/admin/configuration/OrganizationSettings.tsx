/**
 * Organization Settings Component
 * 
 * UI for managing organization-level configurations
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';


interface OrganizationSettingsProps {
  settings: any;
  onUpdate: (setting: string, value: any) => void;
  userRole: 'tenant_admin' | 'vendor_admin';
  saving: boolean;
}

export function OrganizationSettings({
  settings,
  onUpdate,
  userRole,
  saving
}: OrganizationSettingsProps) {
  const [tenantProvisioning, setTenantProvisioning] = useState(
    settings.tenantProvisioning
  );
  const [customBranding, setCustomBranding] = useState(settings.customBranding || {});
  const [dataResidency, setDataResidency] = useState(settings.dataResidency);

  // Auto-save on change
  const handleTenantProvisioningChange = (updates: Partial<typeof tenantProvisioning>) => {
    const updated = { ...tenantProvisioning, ...updates };
    setTenantProvisioning(updated);
    onUpdate('tenant_provisioning', updated);
  };

  const handleCustomBrandingChange = (updates: Partial<typeof customBranding>) => {
    const updated = { ...customBranding, ...updates };
    setCustomBranding(updated);
    onUpdate('custom_branding', updated);
  };

  const handleDataResidencyChange = (updates: Partial<typeof dataResidency>) => {
    const updated = { ...dataResidency, ...updates };
    setDataResidency(updated);
    onUpdate('data_residency', updated);
  };

  return (
    <div className="space-y-6">
      {/* Tenant Provisioning */}
      <Card id="tenant_provisioning">
        <CardHeader>
          <CardTitle>Tenant Provisioning</CardTitle>
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

            <div className="space-y-2">
              <Label htmlFor="maxUsers">Max Users</Label>
              <Input
                id="maxUsers"
                type="number"
                value={tenantProvisioning.maxUsers}
                onChange={(e) =>
                  handleTenantProvisioningChange({
                    maxUsers: parseInt(e.target.value) || 0
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxStorage">Max Storage (GB)</Label>
              <Input
                id="maxStorage"
                type="number"
                value={tenantProvisioning.maxStorageGB}
                onChange={(e) =>
                  handleTenantProvisioningChange({
                    maxStorageGB: parseInt(e.target.value) || 0
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Branding */}
      <Card id="custom_branding">
        <CardHeader>
          <CardTitle>Custom Branding</CardTitle>
          <CardDescription>
            Customize organization appearance and theme
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                value={customBranding.logoUrl || ''}
                onChange={(e) =>
                  handleCustomBrandingChange({ logoUrl: e.target.value })
                }
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <Input
                id="primaryColor"
                type="color"
                value={customBranding.primaryColor || '#000000'}
                onChange={(e) =>
                  handleCustomBrandingChange({ primaryColor: e.target.value })
                }
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

      {/* Data Residency */}
      <Card id="data_residency">
        <CardHeader>
          <CardTitle>Data Residency</CardTitle>
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
              {['GDPR', 'HIPAA', 'SOC2', 'ISO27001'].map((req) => (
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
    </div>
  );
}
