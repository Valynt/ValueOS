import type { ReactNode } from "react";

import { AppearancePage } from "@features/settings/AppearancePage";
import { BrandingPage } from "@features/settings/BrandingPage";
import { CompanyContextPage } from "@features/settings/CompanyContextPage";
import { IntegrationsPage } from "@features/settings/IntegrationsPage";
import { NotificationsPage } from "@features/settings/NotificationsPage";
import { ProfilePage } from "@features/settings/ProfilePage";
import { SecurityPage } from "@features/settings/SecurityPage";

export interface SettingsNavItem {
  path: string;
  label: string;
  element: ReactNode;
}

export const settingsNavItems: SettingsNavItem[] = [
  { path: "profile", label: "My profile", element: <ProfilePage userId="" userRole="user" /> },
  { path: "security", label: "Security", element: <SecurityPage /> },
  { path: "appearance", label: "Appearance", element: <AppearancePage /> },
  { path: "notifications", label: "Notifications", element: <NotificationsPage /> },
  { path: "branding", label: "Branding", element: <BrandingPage /> },
  { path: "integrations", label: "Integrations", element: <IntegrationsPage /> },
  { path: "company-context", label: "Company Context", element: <CompanyContextPage /> },
];
