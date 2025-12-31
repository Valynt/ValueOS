import React from 'react';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { SettingsLayout } from '../../components/Settings/SettingsLayout';
import { useSettings } from '../../contexts/SettingsContext';
import { UserProfile } from './UserProfile';
import { UserSecurity } from './UserSecurity';
import { TeamPermissions } from './TeamPermissions';
import { TeamSettings } from './TeamSettings';
import { TeamAuditLog } from './TeamAuditLog';
import { OrganizationGeneral } from './OrganizationGeneral';
import { OrganizationUsers } from './OrganizationUsers';
import { OrganizationRoles } from './OrganizationRoles';
import { OrganizationSecurity } from './OrganizationSecurity';
import { OrganizationBilling } from './OrganizationBilling';
import { SettingsPlaceholder } from './SettingsPlaceholder';
import { settingsRegistry } from '../../lib/settingsRegistry';

const SettingsContent: React.FC = () => {
  const { currentRoute } = useSettings();
  const route = settingsRegistry.getRoute(currentRoute);

  const renderContent = () => {
    switch (currentRoute) {
      case '/user/profile':
        return <UserProfile />;
      case '/user/security':
        return <UserSecurity />;
      case '/user/notifications':
        return (
          <SettingsPlaceholder
            title="Notifications"
            description="Control your notification preferences across all channels"
          />
        );
      case '/user/appearance':
        return (
          <SettingsPlaceholder
            title="Appearance & Accessibility"
            description="Customize your theme, language, and accessibility settings"
          />
        );
      case '/user/authorized-apps':
        return (
          <SettingsPlaceholder
            title="Authorized Apps"
            description="Manage third-party applications with access to your account"
          />
        );
      case '/team/general':
        return (
          <SettingsPlaceholder
            title="Workspace General Settings"
            description="Manage your workspace name, icon, and basic settings"
          />
        );
      case '/team/members':
        return (
          <SettingsPlaceholder
            title="Workspace Members"
            description="Invite and manage workspace members"
          />
        );
      case '/team/permissions':
        return <TeamPermissions />;
      case '/team/integrations':
        return (
          <SettingsPlaceholder
            title="Workspace Integrations"
            description="Connect apps and services to this workspace"
          />
        );
      case '/team/settings':
        return <TeamSettings />;
      case '/team/audit-logs':
        return <TeamAuditLog />;
      case '/organization/general':
        return <OrganizationGeneral />;
      case '/organization/members':
        return <OrganizationUsers />;
      case '/organization/roles':
        return <OrganizationRoles />;
      case '/organization/security':
        return <OrganizationSecurity />;
      case '/organization/audit-logs':
        return (
          <SettingsPlaceholder
            title="Organization Audit Logs"
            description="View and export comprehensive activity logs for compliance"
          />
        );
      case '/organization/billing':
        return <OrganizationBilling />;
      case '/organization/integrations':
        return (
          <SettingsPlaceholder
            title="Integrations & API"
            description="Manage organization-wide integrations, API keys, and webhooks"
          />
        );
      default:
        return (
          <SettingsPlaceholder
            title={route?.label || 'Settings'}
            description={route?.description || 'This settings page is not yet available'}
          />
        );
    }
  };

  return (
    <SettingsLayout>
      {renderContent()}
    </SettingsLayout>
  );
};

export const SettingsView: React.FC = () => {
  return (
    <SettingsProvider>
      <SettingsContent />
    </SettingsProvider>
  );
};
