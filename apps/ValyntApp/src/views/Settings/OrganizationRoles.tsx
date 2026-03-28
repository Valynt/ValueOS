import { Check, Loader2, Plus, Shield, Trash2, Users, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { SettingsSection } from '../../components/settings';

import {
  createRole,
  deleteRole,
  fetchRoleMatrix,
  type OrganizationRole,
} from '@/services/adminSettingsService';
import { logger } from '@/lib/logger';

const AVAILABLE_PERMISSIONS = [
  { id: 'users.read', name: 'View Users', category: 'Users', action: 'read' as const },
  { id: 'users.manage', name: 'Manage Users', category: 'Users', action: 'admin' as const },
  { id: 'roles.read', name: 'View Roles', category: 'Roles', action: 'read' as const },
  { id: 'roles.manage', name: 'Manage Roles', category: 'Roles', action: 'admin' as const },
  { id: 'content.read', name: 'View Content', category: 'Content', action: 'read' as const },
  { id: 'content.write', name: 'Edit Content', category: 'Content', action: 'write' as const },
  { id: 'billing.read', name: 'View Billing', category: 'Billing', action: 'read' as const },
  { id: 'billing.manage', name: 'Manage Billing', category: 'Billing', action: 'admin' as const },
  { id: 'settings.manage', name: 'Manage Settings', category: 'Settings', action: 'admin' as const },
];

export const OrganizationRoles: React.FC = () => {
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  const loadRoles = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetchRoleMatrix();
      setRoles(response);
    } catch (requestError) {
      logger.error("Failed to load roles:", { error: requestError });
      setError(requestError instanceof Error ? requestError.message : 'Unable to load roles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  const handleCreateRole = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await createRole({
        name: newRoleName,
        description: newRoleDesc,
        permissionKeys: Array.from(selectedPermissions),
      });
      setShowCreateModal(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setSelectedPermissions(new Set());
      await loadRoles();
    } catch (requestError) {
      logger.error("Failed to create role:", { error: requestError });
      setError(requestError instanceof Error ? requestError.message : 'Unable to create role');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteRole(roleId);
      await loadRoles();
    } catch (requestError) {
      logger.error("Failed to delete role:", { error: requestError });
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete role');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions((current) => {
      const next = new Set(current);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const categorizedPermissions = useMemo(
    () => AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
      const existing = acc[perm.category] ?? [];
      acc[perm.category] = [...existing, perm];
      return acc;
    }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>),
    []
  );

  return (
    <div className="space-y-6">
      <SettingsSection title="Role Management" description="Define roles and their associated permissions">
        <div className="p-4 border-b border-gray-200 flex justify-end">
          <button onClick={() => setShowCreateModal(true)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Plus className="h-4 w-4 mr-2" />Create Role</button>
        </div>
        <div className="p-4">
          {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {isLoading ? (
            <div className="py-10 flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading roles...</div>
          ) : roles.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No roles configured for this organization yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((role) => (
                <div key={role.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium text-gray-900">{role.name}</h4>
                    </div>
                    <button className="p-1 hover:bg-red-100 rounded" onClick={() => void handleDeleteRole(role.id)} disabled={isSaving}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{role.description || 'No description provided.'}</p>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-gray-500"><Users className="h-4 w-4 mr-1" />Managed role</div>
                    <span className="text-gray-500">{role.permissions.length} permissions</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Permission Matrix" description="View all permissions by resource and action">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Resource</th><th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Read</th><th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Write</th><th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Admin</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {Object.entries(categorizedPermissions).map(([category, perms]) => (
                  <tr key={category} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{category}</td>
                    {(['read', 'write', 'admin'] as const).map((action) => <td key={action} className="px-4 py-3 text-center">{perms.find((p) => p.action === action) ? <Check className="h-5 w-5 text-green-600 mx-auto" /> : <X className="h-5 w-5 text-gray-300 mx-auto" />}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SettingsSection>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900">Create Custom Role</h3><button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded transition-colors"><X className="h-5 w-5 text-gray-500" /></button></div></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label><input type="text" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Project Manager" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Describe what this role can do" /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="space-y-3">
                  {Object.entries(categorizedPermissions).map(([category, perms]) => (
                    <div key={category} className="border border-gray-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900 mb-2">{category}</p>
                      <div className="space-y-2">
                        {perms.map((perm) => (
                          <label key={perm.id} className="flex items-center space-x-2 text-sm">
                            <input type="checkbox" checked={selectedPermissions.has(perm.id)} onChange={() => togglePermission(perm.id)} className="rounded border-gray-300" />
                            <span className="text-gray-700">{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => void handleCreateRole()} disabled={!newRoleName || selectedPermissions.size === 0 || isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Create Role'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
