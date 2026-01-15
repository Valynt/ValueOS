import { NavLink, Outlet } from "react-router-dom";
import { User, Shield, Bell, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNav = [
  { path: "profile", label: "Profile", icon: User },
  { path: "security", label: "Security", icon: Shield },
  { path: "notifications", label: "Notifications", icon: Bell },
  { path: "appearance", label: "Appearance", icon: Palette },
];

export function SettingsLayout() {
  return (
    <div className="container max-w-5xl py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="flex gap-8">
        {/* Sidebar */}
        <nav className="w-48 flex-shrink-0 space-y-1">
          {settingsNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default SettingsLayout;
