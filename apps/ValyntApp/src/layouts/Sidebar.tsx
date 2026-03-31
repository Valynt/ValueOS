import {
  Bot,
  Boxes,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GitGraph,
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

// Primary product surfaces — shown prominently in nav.
const primaryNavItems = [
  { path: "/dashboard", label: "My Work", icon: Zap },
  { path: "/opportunities", label: "Cases", icon: Briefcase },
  { path: "/living-value-graph", label: "Value Graph", icon: GitGraph },
];

// Platform surfaces — shown below a divider, less prominent.
const platformNavItems = [
  { path: "/models", label: "Models", icon: Boxes },
  { path: "/agents", label: "Agents", icon: Bot },
  { path: "/company", label: "Company Intel", icon: Building2 },
  { path: "/billing", label: "Billing", icon: CreditCard },
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

  // Sort within each group by usage, preserving group boundaries.
  const prioritizedNavItems = useMemo(() => {
    const sortGroup = (group: typeof primaryNavItems) =>
      [...group].sort((a, b) => {
        const routeUsageDiff = getUsageCount(b.path) - getUsageCount(a.path);
        if (routeUsageDiff !== 0) return routeUsageDiff;
        const featureUsageDiff = getFeatureUsageCount(`nav:${b.path}`) - getFeatureUsageCount(`nav:${a.path}`);
        if (featureUsageDiff !== 0) return featureUsageDiff;
        return group.findIndex((item) => item.path === a.path) - group.findIndex((item) => item.path === b.path);
      });
    return [...sortGroup(primaryNavItems), ...sortGroup(platformNavItems)];
  }, [getFeatureUsageCount, getUsageCount]);

  const handleNavClick = (path: string) => {
    trackFeatureUsage(`nav:${path}`);
    if (onClose) onClose();
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border h-full bg-sidebar transition-all duration-200 relative max-w-full overflow-x-hidden",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground font-black text-sm tracking-tighter">V</span>
          </div>
          {!collapsed && (
            <span className="font-black text-sidebar-foreground tracking-[-0.05em] text-lg">VALYNT</span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="lg:hidden min-h-11 min-w-11 p-2 rounded-lg hover:bg-white/8 inline-flex items-center justify-center"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Collapse toggle (desktop) */}
      {!onClose && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[4rem] w-6 h-6 bg-sidebar border border-sidebar-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground z-10 hidden lg:flex shadow-sm transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        {/* Primary product surfaces */}
        <div className="space-y-1">
          {prioritizedNavItems
            .filter((item) => primaryNavItems.some((p) => p.path === item.path))
            .map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => handleNavClick(item.path)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 sm:px-4 min-h-10 rounded-xl text-[13px] font-medium transition-all duration-150",
                    collapsed && "justify-center px-2 min-w-10",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-white/5 hover:text-sidebar-foreground",
                    frequentRouteSet.has(item.path) && !isActive && "ring-1 ring-border bg-white/5"
                  )
                }
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                {!collapsed && (
                  <div className="flex items-center justify-between w-full">
                    <span>{item.label}</span>
                    {frequentRouteSet.has(item.path) && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        <Sparkles className="w-3 h-3" />
                        Hot
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            ))}
        </div>

        {/* Divider */}
        <div className="mx-1 my-3 border-t border-sidebar-border" />

        {/* Platform surfaces */}
        <div className="space-y-1">
          {!collapsed && (
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Platform
            </p>
          )}
          {prioritizedNavItems
            .filter((item) => platformNavItems.some((p) => p.path === item.path))
            .map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => handleNavClick(item.path)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 sm:px-4 min-h-10 rounded-xl text-[13px] font-medium transition-all duration-150",
                    collapsed && "justify-center px-2 min-w-10",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-white/5 hover:text-sidebar-foreground"
                  )
                }
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
        </div>
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        {user && !collapsed && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1 rounded-xl hover:bg-white/5 transition-colors cursor-default">
            <div className="w-7 h-7 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-sidebar-foreground truncate">{user.email}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.1em]">Admin</p>
            </div>
          </div>
        )}
        <button
          onClick={() => logout()}
          aria-label={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 sm:px-4 min-h-10 rounded-xl text-[13px] text-muted-foreground hover:bg-white/5 hover:text-sidebar-foreground w-full transition-all duration-150",
            collapsed && "justify-center px-2 min-w-10"
          )}
        >
          <LogOut className="w-[17px] h-[17px]" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
