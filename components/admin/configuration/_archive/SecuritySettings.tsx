/**
 * Security Settings Component
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SecuritySettingsProps {
  settings: any;
  onUpdate: (setting: string, value: any) => void;
  userRole: 'tenant_admin' | 'vendor_admin';
  saving: boolean;
}

export function SecuritySettings({
  settings,
  onUpdate,
  userRole,
  saving
}: SecuritySettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security & Governance</CardTitle>
        <CardDescription>
          Audit integrity, retention policies, manifesto strictness, secret rotation, RLS
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Security settings UI coming soon...</p>
      </CardContent>
    </Card>
  );
}
