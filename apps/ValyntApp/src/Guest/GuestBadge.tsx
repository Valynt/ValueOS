/**
 * Guest Badge Component
 * 
 * Displays a visual indicator that the user is accessing as a guest
 */

import { Clock, Edit3, Eye, MessageSquare, UserCheck } from 'lucide-react';

import { getGuestPermissionManager } from '../guestPermissions';

import { GuestPermissions } from '@/GuestAccessService';

export interface GuestBadgeProps {
  guestName: string;
  guestEmail: string;
  permissions: GuestPermissions;
  expiresAt?: string;
  className?: string;
}

export function GuestBadge({
  guestName,
  guestEmail,
  permissions,
  expiresAt,
  className = '',
}: GuestBadgeProps) {
  const permissionManager = getGuestPermissionManager();
  const summary = permissionManager.getPermissionSummary(permissions);

  const getPermissionIcon = () => {
    if (permissions.can_edit) {
      return <Edit3 className="w-4 h-4" />;
    }
    if (permissions.can_comment) {
      return <MessageSquare className="w-4 h-4" />;
    }
    return <Eye className="w-4 h-4" />;
  };

  const getPermissionColor = () => {
    if (permissions.can_edit) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    if (permissions.can_comment) {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const formatExpiresAt = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'Expired';
    } else if (diffDays === 0) {
      return 'Expires today';
    } else if (diffDays === 1) {
      return 'Expires tomorrow';
    } else if (diffDays < 7) {
      return `Expires in ${diffDays} days`;
    } else {
      return `Expires ${date.toLocaleDateString()}`;
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Guest Indicator */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${getPermissionColor()}`}>
        <UserCheck className="w-4 h-4" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">Guest Access</span>
          <span className="text-xs opacity-75">{guestName}</span>
        </div>
      </div>

      {/* Permission Level */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getPermissionColor()}`}>
        {getPermissionIcon()}
        <span className="text-sm font-medium capitalize">{summary.level.replace('-', ' ')}</span>
      </div>

      {/* Expiration */}
      {expiresAt && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-700">
          <Clock className="w-4 h-4" />
          <span className="text-sm">{formatExpiresAt(expiresAt)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact Guest Badge (for headers/navbars)
 */
export function GuestBadgeCompact({
  guestName,
  permissions,
  className = '',
}: Omit<GuestBadgeProps, 'guestEmail' | 'expiresAt'>) {
  const getPermissionIcon = () => {
    if (permissions.can_edit) {
      return <Edit3 className="w-3 h-3" />;
    }
    if (permissions.can_comment) {
      return <MessageSquare className="w-3 h-3" />;
    }
    return <Eye className="w-3 h-3" />;
  };

  const getPermissionColor = () => {
    if (permissions.can_edit) {
      return 'bg-green-100 text-green-800';
    }
    if (permissions.can_comment) {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-md ${getPermissionColor()} ${className}`}>
      <UserCheck className="w-3 h-3" />
      <span className="text-xs font-medium">Guest: {guestName}</span>
      {getPermissionIcon()}
    </div>
  );
}

/**
 * Guest Permission Info (detailed view)
 */
export function GuestPermissionInfo({
  permissions,
  className = '',
}: {
  permissions: GuestPermissions;
  className?: string;
}) {
  const permissionManager = getGuestPermissionManager();
  const summary = permissionManager.getPermissionSummary(permissions);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Your Permissions</h3>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <div className={`w-2 h-2 rounded-full ${permissions.can_view ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>View content</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <div className={`w-2 h-2 rounded-full ${permissions.can_comment ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>Add comments</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <div className={`w-2 h-2 rounded-full ${permissions.can_edit ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>Edit elements</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-600">{summary.description}</p>
      </div>
    </div>
  );
}

/**
 * Guest Access Banner (full-width notification)
 */
export function GuestAccessBanner({
  guestName,
  permissions,
  expiresAt,
  onRequestAccess,
  className = '',
}: GuestBadgeProps & {
  onRequestAccess?: () => void;
}) {
  const permissionManager = getGuestPermissionManager();
  const summary = permissionManager.getPermissionSummary(permissions);

  const formatExpiresAt = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'Your access has expired';
    } else if (diffDays < 3) {
      return `Your access expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    }
    return null;
  };

  const expirationMessage = expiresAt ? formatExpiresAt(expiresAt) : null;
  const showWarning = expiresAt && new Date(expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Guest Access: {guestName}
              </p>
              <p className="text-xs text-gray-600">
                {summary.description}
              </p>
            </div>
          </div>

          {expirationMessage && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-md ${
              showWarning ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
            }`}>
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">{expirationMessage}</span>
            </div>
          )}
        </div>

        {onRequestAccess && !permissions.can_edit && (
          <button
            onClick={onRequestAccess}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
          >
            Request Full Access
          </button>
        )}
      </div>
    </div>
  );
}
