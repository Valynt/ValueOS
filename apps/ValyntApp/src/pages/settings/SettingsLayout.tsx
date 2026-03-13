/**
 * SettingsLayout - Horizontal tabs navigation with edit-in-place content
 * 
 * Pattern: Global sidebar (left) + Local tabs (top) + Row-based list content
 */

import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";

const settingsTabs = [
  { path: "profile", label: "My profile" },
  { path: "security", label: "Security" },
  { path: "billing", label: "Billing" },
  { path: "notifications", label: "Notifications" },
  { path: "team", label: "Team" },
  { path: "branding", label: "Branding" },
  { path: "integrations", label: "Integrations" },
  { path: "tenant-context", label: "Company Context" },
];

export function SettingsLayout() {
  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-xl font-semibold py-6">Settings</h1>
          
          {/* Horizontal Tabs */}
          <nav className="flex gap-1 -mb-px">
            {settingsTabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) =>
                  cn(
                    "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Outlet />
      </div>
    </div>
  );
}

export default SettingsLayout;
