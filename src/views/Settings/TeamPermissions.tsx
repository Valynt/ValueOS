import React, { useState } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { Shield, Check, X, AlertCircle, Info, Crown, Users, User } from 'lucide-react';
import { TeamMemberRole } from '../../types';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'workspace' | 'content' | 'members' | 'integrations' | 'billing';
}

interface RolePermissions {
  [key: string]: { [permissionId: string]: boolean };
}

const PERMISSIONS: Permission[] = [
  { id: 'workspace.manage', name: 'Manage Workspace', description: 'Edit workspace settings and preferences', category: 'workspace' },
  { id: 'workspace.delete', name: 'Delete Workspace', description: 'Permanently delete the workspace', category: 'workspace' },
  { id: 'workspace.export', name: 'Export Data', description: 'Export workspace data', category: 'workspace' },

  { id: 'content.create', name: 'Create Content', description: 'Create new content and projects', category: 'content' },
  { id: 'content.edit', name: 'Edit Content', description: 'Edit existing content', category: 'content' },
  { id: 'content.delete', name: 'Delete Content', description: 'Delete content permanently', category: 'content' },
  { id: 'content.share', name: 'Share Content', description: 'Share content externally', category: 'content' },

  { id: 'members.invite', name: 'Invite Members', description: 'Send invitations to new members', category: 'members' },
  { id: 'members.remove', name: 'Remove Members', description: 'Remove members from workspace', category: 'members' },
  { id: 'members.roles', name: 'Manage Roles', description: 'Change member roles and permissions', category: 'members' },

  { id: 'integrations.manage', name: 'Manage Integrations', description: 'Enable and configure integrations', category: 'integrations' },
  { id: 'integrations.remove', name: 'Remove Integrations', description: 'Disconnect integrations', category: 'integrations' },

  { id: 'billing.view', name: 'View Billing', description: 'View billing information', category: 'billing' },
  { id: 'billing.manage', name: 'Manage Billing', description: 'Update payment methods and plans', category: 'billing' },
];

const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  owner: {
    'workspace.manage': true,
    'workspace.delete': true,
    'workspace.export': true,
    'content.create': true,
    'content.edit': true,
    'content.delete': true,
    'content.share': true,
    'members.invite': true,
    'members.remove': true,
    'members.roles': true,
    'integrations.manage': true,
    'integrations.remove': true,
    'billing.view': true,
    'billing.manage': true,
  },
  admin: {
    'workspace.manage': true,
    'workspace.delete': false,
    'workspace.export': true,
    'content.create': true,
    'content.edit': true,
    'content.delete': true,
    'content.share': true,
    'members.invite': true,
    'members.remove': true,
    'members.roles': true,
    'integrations.manage': true,
    'integrations.remove': true,
    'billing.view': true,
    'billing.manage': false,
  },
  member: {
    'workspace.manage': false,
    'workspace.delete': false,
    'workspace.export': false,
    'content.create': true,
    'content.edit': true,
    'content.delete': false,
    'content.share': true,
    'members.invite': false,
    'members.remove': false,
    'members.roles': false,
    'integrations.manage': false,
    'integrations.remove': false,
    'billing.view': false,
    'billing.manage': false,
  },
  guest: {
    'workspace.manage': false,
    'workspace.delete': false,
    'workspace.export': false,
    'content.create': false,
    'content.edit': false,
    'content.delete': false,
    'content.share': false,
    'members.invite': false,
    'members.remove': false,
    'members.roles': false,
    'integrations.manage': false,
    'integrations.remove': false,
    'billing.view': false,
    'billing.manage': false,
  },
};

export const TeamPermissions: React.FC = () => {
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [customMode, setCustomMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const roles: Array<{ value: TeamMemberRole; label: string; icon: React.ReactNode; color: string }> = [
    { value: 'owner', label: 'Owner', icon: <Crown className="h-4 w-4" />, color: 'text-yellow-700' },
    { value: 'admin', label: 'Admin', icon: <Shield className="h-4 w-4" />, color: 'text-blue-700' },
    { value: 'member', label: 'Member', icon: <Users className="h-4 w-4" />, color: 'text-muted-foreground' },
    { value: 'guest', label: 'Guest', icon: <User className="h-4 w-4" />, color: 'text-green-700' },
  ];

  const categories = [
    { id: 'workspace', label: 'Workspace Management' },
    { id: 'content', label: 'Content & Projects' },
    { id: 'members', label: 'Member Management' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'billing', label: 'Billing & Plans' },
  ];

  const togglePermission = (role: TeamMemberRole, permissionId: string) => {
    if (role === 'owner') return;

    setRolePermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permissionId]: !prev[role]?.[permissionId],
      },
    }));
    setHasUnsavedChanges(true);
    setCustomMode(true);
  };

  const resetToDefaults = () => {
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    setCustomMode(false);
    setHasUnsavedChanges(false);
  };

  const saveChanges = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    setHasUnsavedChanges(false);
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Permissions Matrix"
        description="Configure workspace-level permissions for each role"
        actions={
          <div className="flex items-center space-x-3">
            {customMode && (
              <span className="text-xs px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                Custom
              </span>
            )}
            {hasUnsavedChanges && (
              <>
                <button
                  onClick={resetToDefaults}
                  className="text-sm px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Reset to Defaults
                </button>
                <button
                  onClick={saveChanges}
                  className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-light-blue-sm hover:bg-primary/90 transition-colors"
                >
                  Save Changes
                </button>
              </>
            )}
          </div>
        }
      >
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Permission Inheritance</p>
                <p>
                  Permissions are inherited from the organization level. Workspace settings can only restrict permissions, not expand them beyond organization limits.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="sticky left-0 bg-muted px-6 py-3 text-left text-sm font-semibold text-foreground w-80">
                      Permission
                    </th>
                    {roles.map((role) => (
                      <th key={role.value} className="px-4 py-3 text-center min-w-[120px]">
                        <div className="flex flex-col items-center space-y-1">
                          <div className={role.color}>{role.icon}</div>
                          <span className="text-sm font-semibold text-foreground">{role.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <React.Fragment key={category.id}>
                      <tr className="bg-muted">
                        <td colSpan={5} className="sticky left-0 px-6 py-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {category.label}
                          </span>
                        </td>
                      </tr>
                      {PERMISSIONS.filter(p => p.category === category.id).map((permission) => (
                        <tr key={permission.id} className="border-b border-border hover:bg-accent/40">
                          <td className="sticky left-0 bg-card hover:bg-accent/40 px-6 py-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{permission.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{permission.description}</p>
                            </div>
                          </td>
                          {roles.map((role) => {
                            const hasPermission = rolePermissions[role.value]?.[permission.id];
                            const isOwner = role.value === 'owner';

                            return (
                              <td key={role.value} className="px-4 py-3 text-center">
                                <button
                                  onClick={() => !isOwner && togglePermission(role.value, permission.id)}
                                  disabled={isOwner}
                                  className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all ${
                                    isOwner
                                      ? 'cursor-not-allowed bg-muted'
                                      : hasPermission
                                      ? 'bg-green-100 hover:bg-green-200'
                                      : 'bg-muted hover:bg-muted/80'
                                  }`}
                                  title={isOwner ? 'Owner permissions cannot be modified' : hasPermission ? 'Enabled' : 'Disabled'}
                                >
                                  {hasPermission ? (
                                    <Check className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <X className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-900">
                <p className="font-medium mb-1">Permission Conflicts</p>
                <p>
                  If a permission conflict is detected between workspace and organization levels, the most restrictive permission will apply. Contact your organization admin to expand permissions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-100 rounded flex items-center justify-center">
                  <Check className="h-3 w-3 text-green-600" />
                </div>
                <span>Enabled</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-muted rounded flex items-center justify-center">
                  <X className="h-3 w-3 text-muted-foreground" />
                </div>
                <span>Disabled</span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {PERMISSIONS.length} permissions across {categories.length} categories
            </span>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};
