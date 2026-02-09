import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SettingsSection } from '../../components/settings';
import {
  Ban, CheckCircle, ChevronLeft, ChevronRight, Clock, Download,
  Mail, MoreVertical, Search, UserPlus, XCircle
} from 'lucide-react';

interface OrganizationUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  department?: string;
  joinedAt: string;
}
import { analyticsClient } from '../../lib/analyticsClient';
import { useAuth } from '../../contexts/AuthContext';
import { addCSRFHeader } from '../../security/CSRFProtection';

const PAGE_SIZE = 10;
const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'User' },
  { value: 'viewer', label: 'Viewer' },
] as const;

type TenantRoleValue = typeof ROLE_OPTIONS[number]['value'];

const roleLabelToValue = (label: string): TenantRoleValue => {
  const option = ROLE_OPTIONS.find((role) => role.label === label);
  return option?.value || 'member';
};

const roleValueToLabel = (value: TenantRoleValue): string => {
  return ROLE_OPTIONS.find((role) => role.value === value)?.label || 'User';
};

export const OrganizationUsers: React.FC = () => {
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, _setDeptFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<keyof OrganizationUser>('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TenantRoleValue>('member');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const { session } = useAuth();

  const buildHeaders = useCallback(
    (includeJson?: boolean) => {
      const headers: Record<string, string> = {};
      if (includeJson) {
        headers['Content-Type'] = 'application/json';
      }
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      return addCSRFHeader(headers) as Record<string, string>;
    },
    [session?.access_token]
  );

  useEffect(() => {
    const fetchUsers = async () => {
      if (!session?.access_token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch('/api/admin/users', {
          headers: buildHeaders(),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load users');
        }

        setUsers(payload.users || []);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load users');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [buildHeaders, session?.access_token]);

  const filteredAndSortedUsers = useMemo(() => {
    const result = users.filter(user => {
      const matchesSearch = !searchQuery ||
        user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      const matchesDept = deptFilter === 'all' || user.department === deptFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesDept;
    });

    result.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [users, searchQuery, roleFilter, statusFilter, deptFilter, sortColumn, sortDirection]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSortedUsers.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedUsers, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedUsers.length / PAGE_SIZE);

  const handleSort = (column: keyof OrganizationUser) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === paginatedUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(paginatedUsers.map(u => u.id)));
    }
  };

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail) return;

    try {
      const response = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: buildHeaders(true),
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Invite failed');
      }

      setUsers((current) => [payload.user, ...current]);
      setInviteStatus(`Invitation sent to ${inviteEmail}`);
      analyticsClient.trackWorkflowEvent('teammate_invited', 'team_invite', {
        email: inviteEmail,
        role: roleValueToLabel(inviteRole),
      });
      setInviteModalOpen(false);
      setInviteEmail('');
    } catch (error) {
      setInviteStatus(
        error instanceof Error ? error.message : 'Failed to send invite'
      );
    }
  };

  const handleRoleChange = async (userId: string, role: TenantRoleValue) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: buildHeaders(true),
        body: JSON.stringify({ role }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Role update failed');
      }

      setUsers((current) =>
        current.map((user) =>
          user.id === userId ? { ...user, role: roleValueToLabel(role) } : user
        )
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to update role');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: buildHeaders(),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Removal failed');
      }

      setUsers((current) => current.filter((user) => user.id !== userId));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to remove user');
    }
  };

  const getStatusIcon = (status: OrganizationUser['status']) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'invited': return <Mail className="h-4 w-4 text-blue-600" />;
      case 'suspended': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'deactivated': return <Ban className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: OrganizationUser['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'invited': return 'bg-blue-100 text-blue-800';
      case 'suspended': return 'bg-yellow-100 text-yellow-800';
      case 'deactivated': return 'bg-red-100 text-red-800';
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="User Directory"
        description="Manage all users across your organization"
        actions={
          <div className="flex space-x-2">
            <button className="flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            <button
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => {
                setInviteModalOpen(true);
                setInviteStatus(null);
                analyticsClient.trackWorkflowEvent('teammate_invite_opened', 'team_invite', {});
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                aria-label="Search users by name or email"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.label}>
                  {role.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>

          {loadError && (
            <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {loadError}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center p-6 border border-gray-200 rounded-lg text-sm text-gray-500">
              Loading users...
            </div>
          )}

          {!isLoading && selectedUsers.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm text-blue-900">
                {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex space-x-2">
                <button className="px-3 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
                  Change Role
                </button>
                <button className="px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors">
                  Deactivate
                </button>
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left w-12">
                      <input
                        type="checkbox"
                        checked={selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 focus:ring-blue-500"
                      />
                    </th>
                    <th
                      onClick={() => handleSort('fullName')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                    >
                      Name {sortColumn === 'fullName' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => handleSort('email')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                    >
                      Email {sortColumn === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Department</th>
                    <th
                      onClick={() => handleSort('status')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                    >
                      Status {sortColumn === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Last Login</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                          className="rounded border-gray-300 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{user.fullName}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={roleLabelToValue(user.role)}
                          onChange={(event) =>
                            handleRoleChange(
                              user.id,
                              event.target.value as TenantRoleValue
                            )
                          }
                          className="text-xs font-medium bg-blue-50 text-blue-800 border border-blue-100 rounded-full px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.department}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                          {getStatusIcon(user.status)}
                          <span className="ml-1 capitalize">{user.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                            <MoreVertical className="h-5 w-5 text-gray-400" />
                          </button>
                          <button
                            className="text-xs text-red-600 hover:text-red-700"
                            onClick={() => handleRemoveUser(user.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length} users
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {inviteStatus && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            {inviteStatus}
          </div>
        )}
      </SettingsSection>

      {isInviteModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase text-blue-600 font-semibold">Beta Cohort</p>
                <h3 className="text-lg font-semibold text-gray-900">Invite a teammate</h3>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Close invite dialog"
              >
                <XCircle className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Invites are auto-tagged with <span className="font-semibold">beta_cohort</span> for priority support.</p>
            <form className="space-y-4" onSubmit={handleInviteSubmit}>
              <div>
                <label
                  htmlFor="invite-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="teammate@company.com"
                />
              </div>
              <div>
                <label
                  htmlFor="invite-role"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as TenantRoleValue)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Send invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
