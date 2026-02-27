import {
  Bot,
  Boxes,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useNavigationPersonalization } from "@/hooks/useNavigationPersonalization";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/dashboard", label: "My Work", icon: Zap },
  { path: "/opportunities", label: "Cases", icon: Briefcase },
  { path: "/models", label: "Models", icon: Boxes },
  { path: "/agents", label: "Agents", icon: Bot },
  { path: "/company", label: "Company Intel", icon: Building2 },
  { path: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const { trackRouteVisit, trackFeatureUsage, getUsageCount, getFeatureUsageCount, frequentRouteSet } =
    useNavigationPersonalization();

  useEffect(() => {
    trackRouteVisit(location.pathname);
  }, [location.pathname, trackRouteVisit]);

  const prioritizedNavItems = useMemo(() => {
    return [...navItems].sort((a, b) => {
      const routeUsageDiff = getUsageCount(b.path) - getUsageCount(a.path);
      if (routeUsageDiff !== 0) return routeUsageDiff;

      const featureUsageDiff = getFeatureUsageCount(`nav:${b.path}`) - getFeatureUsageCount(`nav:${a.path}`);
      if (featureUsageDiff !== 0) return featureUsageDiff;
      return (
        navItems.findIndex((item) => item.path === a.path) -
        navItems.findIndex((item) => item.path === b.path)
      );
    });
  }, [getFeatureUsageCount, getUsageCount]);

  const handleNavClick = (path: string) => {
    trackFeatureUsage(`nav:${path}`);
    if (onClose) onClose();
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-zinc-200 h-full bg-white transition-all duration-200 relative max-w-full overflow-x-hidden",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-200">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
          <div className="w-8 h-8 bg-zinc-950 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-sm tracking-tighter">V</span>
          </div>
          {!collapsed && (
            <span className="font-black text-zinc-950 tracking-[-0.05em] text-lg">VALYNT</span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="lg:hidden min-h-11 min-w-11 p-2 rounded-lg hover:bg-zinc-100 inline-flex items-center justify-center"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        )}
      </div>

      {/* Collapse toggle (desktop) */}
      {!onClose && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[4.5rem] w-11 h-11 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 z-10 hidden lg:flex shadow-sm"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {prioritizedNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => handleNavClick(item.path)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 sm:px-4 min-h-11 rounded-xl text-[13px] font-medium transition-colors",
                collapsed && "justify-center px-2 min-w-11",
                isActive
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
                frequentRouteSet.has(item.path) && !isActive && "ring-1 ring-zinc-200 bg-zinc-50"
              )
            }
          >
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && (
              <div className="flex items-center justify-between w-full">
                <span>{item.label}</span>
                {frequentRouteSet.has(item.path) && (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-400">
                    <Sparkles className="w-3 h-3" />
                    Hot
                  </span>
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-zinc-200">
        {user && !collapsed && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-zinc-900 truncate">{user.email}</p>
              <p className="text-[11px] text-zinc-400">Admin</p>
            </div>
          </div>
        )}
        <button
          onClick={() => logout()}
          aria-label={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 sm:px-4 min-h-11 rounded-xl text-[13px] text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 w-full transition-colors",
            collapsed && "justify-center px-2 min-w-11"
          )}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
