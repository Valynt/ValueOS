import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Settings,
  CreditCard,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/providers/AuthProvider";
import { PrefetchNavLink } from "@/components/common/PrefetchLink";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/billing", label: "Billing", icon: CreditCard },
  { path: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();

  const handleNavClick = () => {
    // Close mobile sidebar when navigation occurs
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-300 h-full",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo and mobile close */}
      <div className="h-14 flex items-center justify-between px-4 border-b">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center w-full")}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold">V</span>
          </div>
          {!collapsed && <span className="font-semibold">Valynt</span>}
        </div>

        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
            <span className="sr-only">Close sidebar</span>
          </button>
        )}
      </div>

      {/* Desktop toggle */}
      {!onClose && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-16 w-6 h-6 bg-card border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground z-10 hidden lg:flex"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <PrefetchNavLink
            key={item.path}
            to={item.path}
            prefetch={true}
            intersection={false}
            onClick={handleNavClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                collapsed && "justify-center",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </PrefetchNavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-2 border-t">
        {user && (
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md",
              collapsed && "justify-center"
            )}
          >
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.email}</p>
              </div>
            )}
          </div>
        )}
        <button
          onClick={() => signOut()}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground w-full transition-colors",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
