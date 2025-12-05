import React, { useState } from 'react';
import { Crown, Shield, User, Users, ChevronDown, Info, AlertTriangle } from 'lucide-react';
import { TeamMemberRole } from '../../types';

interface RoleOption {
  value: TeamMemberRole;
  label: string;
  description: string;
  icon: React.ReactNode;
  hierarchy: number;
  permissions: string[];
}

interface MemberRoleSelectorProps {
  currentRole: TeamMemberRole;
  currentUserRole: TeamMemberRole;
  onRoleChange: (newRole: TeamMemberRole) => void;
  disabled?: boolean;
  showPermissions?: boolean;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'owner',
    label: 'Owner',
    description: 'Full access to all workspace features and settings',
    icon: <Crown className="h-4 w-4" />,
    hierarchy: 4,
    permissions: [
      'Manage workspace settings',
      'Manage members and roles',
      'Delete workspace',
      'Manage billing',
      'Full content access',
    ],
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Can manage members and workspace settings',
    icon: <Shield className="h-4 w-4" />,
    hierarchy: 3,
    permissions: [
      'Manage workspace settings',
      'Invite and remove members',
      'Change member roles (except owner)',
      'Full content access',
    ],
  },
  {
    value: 'member',
    label: 'Member',
    description: 'Can view and edit workspace content',
    icon: <Users className="h-4 w-4" />,
    hierarchy: 2,
    permissions: [
      'View workspace content',
      'Create and edit content',
      'Comment on items',
      'Share content',
    ],
  },
  {
    value: 'guest',
    label: 'Guest',
    description: 'Limited access to specific content only',
    icon: <User className="h-4 w-4" />,
    hierarchy: 1,
    permissions: [
      'View assigned content',
      'Comment on assigned items',
      'Cannot invite members',
    ],
  },
];

export const MemberRoleSelector: React.FC<MemberRoleSelectorProps> = ({
  currentRole,
  currentUserRole,
  onRoleChange,
  disabled = false,
  showPermissions = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TeamMemberRole>(currentRole);

  const currentUserHierarchy = ROLE_OPTIONS.find(r => r.value === currentUserRole)?.hierarchy || 0;
  const currentRoleOption = ROLE_OPTIONS.find(r => r.value === selectedRole);

  const canChangeToRole = (targetRole: TeamMemberRole): boolean => {
    const targetHierarchy = ROLE_OPTIONS.find(r => r.value === targetRole)?.hierarchy || 0;
    return currentUserHierarchy >= targetHierarchy;
  };

  const handleRoleSelect = (role: TeamMemberRole) => {
    if (!canChangeToRole(role)) return;

    setSelectedRole(role);
    onRoleChange(role);
    setIsOpen(false);
  };

  const getRoleColor = (role: TeamMemberRole) => {
    switch (role) {
      case 'owner':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'admin':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'member':
        return 'text-gray-700 bg-gray-50 border-gray-200';
      case 'guest':
        return 'text-green-700 bg-green-50 border-green-200';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center justify-between w-full px-3 py-2 border rounded-lg transition-colors ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed opacity-60'
            : 'bg-white hover:bg-gray-50'
        } ${getRoleColor(selectedRole)}`}
      >
        <div className="flex items-center space-x-2">
          {currentRoleOption?.icon}
          <span className="font-medium">{currentRoleOption?.label}</span>
        </div>
        {!disabled && <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && !disabled && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {ROLE_OPTIONS.map((role) => {
              const canChange = canChangeToRole(role.value);
              const isSelected = role.value === selectedRole;

              return (
                <button
                  key={role.value}
                  onClick={() => canChange && handleRoleSelect(role.value)}
                  disabled={!canChange}
                  className={`w-full text-left p-3 border-b border-gray-100 transition-colors ${
                    isSelected
                      ? 'bg-blue-50'
                      : canChange
                      ? 'hover:bg-gray-50'
                      : 'opacity-50 cursor-not-allowed bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`}>
                      {role.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                          {role.label}
                        </span>
                        {!canChange && (
                          <div className="flex items-center text-xs text-red-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            <span>Insufficient permissions</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{role.description}</p>
                      {showPermissions && (
                        <ul className="text-xs text-gray-500 space-y-1">
                          {role.permissions.slice(0, 3).map((permission, idx) => (
                            <li key={idx} className="flex items-start">
                              <span className="mr-1">•</span>
                              <span>{permission}</span>
                            </li>
                          ))}
                          {role.permissions.length > 3 && (
                            <li className="text-gray-400">+{role.permissions.length - 3} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="p-3 bg-gray-50 border-t border-gray-200">
              <div className="flex items-start space-x-2 text-xs text-gray-600">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  You can only assign roles at or below your current role level.
                  {currentUserRole !== 'owner' && ' Contact an owner to change owner roles.'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface BulkRoleSelectorProps {
  selectedCount: number;
  currentUserRole: TeamMemberRole;
  onBulkRoleChange: (role: TeamMemberRole) => void;
  onCancel: () => void;
}

export const BulkRoleSelector: React.FC<BulkRoleSelectorProps> = ({
  selectedCount,
  currentUserRole,
  onBulkRoleChange,
  onCancel,
}) => {
  const [selectedRole, setSelectedRole] = useState<TeamMemberRole>('member');

  const handleApply = () => {
    onBulkRoleChange(selectedRole);
  };

  return (
    <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <span className="text-sm font-medium text-blue-900">
        Change role for {selectedCount} member{selectedCount > 1 ? 's' : ''}:
      </span>
      <div className="flex-1 max-w-xs">
        <MemberRoleSelector
          currentRole={selectedRole}
          currentUserRole={currentUserRole}
          onRoleChange={setSelectedRole}
          showPermissions={false}
        />
      </div>
      <button
        onClick={handleApply}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        Apply
      </button>
      <button
        onClick={onCancel}
        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-white transition-colors"
      >
        Cancel
      </button>
    </div>
  );
};
