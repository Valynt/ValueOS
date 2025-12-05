import React, { useState } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import { Shield, Plus, Edit2, Trash2, Users, Check, X, Lock } from 'lucide-react';
import { OrganizationRole } from '../../types';

const MOCK_ROLES: OrganizationRole[] = [
  {
    id: '1',
    name: 'Admin',
    description: 'Full system access',
    isDefault: true,
    isCustom: false,
    permissions: ['users.manage', 'roles.manage', 'billing.manage', 'settings.manage'],
    userCount: 5,
    createdAt: '2024-01-01',
  },
  {
    id: '2',
    name: 'User',
    description: 'Standard user access',
    isDefault: true,
    isCustom: false,
    permissions: ['content.read', 'content.write'],
    userCount: 45,
    createdAt: '2024-01-01',
  },
  {
    id: '3',
    name: 'Viewer',
    description: 'Read-only access',
    isDefault: true,
    isCustom: false,
    permissions: ['content.read'],
    userCount: 15,
    createdAt: '2024-01-01',
  },
];

const AVAILABLE_PERMISSIONS = [
  { id: 'users.read', name: 'View Users', category: 'Users', resource: 'users', action: 'read' as const },
  { id: 'users.manage', name: 'Manage Users', category: 'Users', resource: 'users', action: 'admin' as const },
  { id: 'roles.read', name: 'View Roles', category: 'Roles', resource: 'roles', action: 'read' as const },
  { id: 'roles.manage', name: 'Manage Roles', category: 'Roles', resource: 'roles', action: 'admin' as const },
  { id: 'content.read', name: 'View Content', category: 'Content', resource: 'content', action: 'read' as const },
  { id: 'content.write', name: 'Edit Content', category: 'Content', resource: 'content', action: 'write' as const },
  { id: 'billing.read', name: 'View Billing', category: 'Billing', resource: 'billing', action: 'read' as const },
  { id: 'billing.manage', name: 'Manage Billing', category: 'Billing', resource: 'billing', action: 'admin' as const },
  { id: 'settings.manage', name: 'Manage Settings', category: 'Settings', resource: 'settings', action: 'admin' as const },
];

export const OrganizationRoles: React.FC = () => {
  const [roles, setRoles] = useState<OrganizationRole[]>(MOCK_ROLES);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<OrganizationRole | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  const handleCreateRole = () => {
    const newRole: OrganizationRole = {
      id: `${roles.length + 1}`,
      name: newRoleName,
      description: newRoleDesc,
      isDefault: false,
      isCustom: true,
      permissions: Array.from(selectedPermissions),
      userCount: 0,
      createdAt: new Date().toISOString(),
    };

    setRoles([...roles, newRole]);
    setShowCreateModal(false);
    setNewRoleName('');
    setNewRoleDesc('');
    setSelectedPermissions(new Set());
  };

  const togglePermission = (permId: string) => {
    const newPerms = new Set(selectedPermissions);
    if (newPerms.has(permId)) {
      newPerms.delete(permId);
    } else {
      newPerms.add(permId);
    }
    setSelectedPermissions(newPerms);
  };

  const categorizedPermissions = AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>);

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Role Management"
        description="Define roles and their associated permissions"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div
              key={role.id}
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Shield className={`h-5 w-5 ${role.isDefault ? 'text-blue-600' : 'text-gray-600'}`} />
                  <h4 className="font-medium text-gray-900">{role.name}</h4>
                  {role.isDefault && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Default</span>
                  )}
                </div>
                {role.isCustom && (
                  <div className="flex space-x-1">
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <Edit2 className="h-4 w-4 text-gray-600" />
                    </button>
                    <button className="p-1 hover:bg-red-100 rounded">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-3">{role.description}</p>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-gray-500">
                  <Users className="h-4 w-4 mr-1" />
                  {role.userCount} users
                </div>
                <span className="text-gray-500">{role.permissions.length} permissions</span>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">Permissions:</p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 3).map(perm => (
                    <span key={perm} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                      {perm.split('.')[1]}
                    </span>
                  ))}
                  {role.permissions.length > 3 && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">
                      +{role.permissions.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Permission Matrix" description="View all permissions by resource and action">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Resource</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Read</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Write</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Object.entries(categorizedPermissions).map(([category, perms]) => (
                  <tr key={category} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{category}</td>
                    {(['read', 'write', 'admin'] as const).map(action => {
                      const perm = perms.find(p => p.action === action);
                      return (
                        <td key={action} className="px-4 py-3 text-center">
                          {perm ? (
                            <Check className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-gray-300 mx-auto" />
                          )}
                        </td>
                      );
                    })}
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
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Create Custom Role</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Project Manager"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe what this role can do"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="space-y-3">
                  {Object.entries(categorizedPermissions).map(([category, perms]) => (
                    <div key={category} className="border border-gray-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900 mb-2">{category}</p>
                      <div className="space-y-2">
                        {perms.map(perm => (
                          <label key={perm.id} className="flex items-center space-x-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedPermissions.has(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              className="rounded border-gray-300 focus:ring-blue-500"
                            />
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
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRole}
                disabled={!newRoleName || selectedPermissions.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
