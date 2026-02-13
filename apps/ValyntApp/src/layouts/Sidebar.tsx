import {
  Zap,
  Briefcase,
  Boxes,
  Bot,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Building2,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigationPersonalization } from "@/hooks/useNavigationPersonalization";
import { NAVIGATION_ITEMS } from "@/layouts/navigationConfig";
import { cn } from "@/lib/utils";

const iconByPath = {
  "/dashboard": Zap,
  "/opportunities": Briefcase,
  "/models": Boxes,
  "/agents": Bot,
  "/company": Building2,
  "/settings": Settings,
};

const settingsPath = "/settings";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { currentTenant } = useTenant();

  const storageScope = user?.id ?? currentTenant?.id ?? "anon";
  const { routeUsage, frequentRoutePaths, recordRouteVisit } = useNavigationPersonalization(storageScope);

  const prioritizedItems = useMemo(() => {
    const score = (path: string) => routeUsage[path] ?? 0;

    const primary = NAVIGATION_ITEMS.filter((item) => item.path !== settingsPath).sort(
      (a, b) => score(b.path) - score(a.path),
    );
    const settings = NAVIGATION_ITEMS.find((item) => item.path === settingsPath);

    return settings ? [...primary, settings] : primary;
  }, [routeUsage]);

  const frequentSet = useMemo(() => new Set(frequentRoutePaths.slice(0, 2)), [frequentRoutePaths]);

  const handleNavClick = (path: string) => {
    recordRouteVisit(path);
    if (onClose) onClose();
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-zinc-200 h-full bg-white transition-all duration-200 relative",
        collapsed ? "w-16" : "w-64",
      )}
    >
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
            className="lg:hidden p-1 rounded-md hover:bg-zinc-100"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        )}
      </div>

      {!onClose && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 z-10 hidden lg:flex shadow-sm"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1">
        {prioritizedItems.map((item) => {
          const Icon = iconByPath[item.path as keyof typeof iconByPath] ?? Zap;
          const isFrequent = frequentSet.has(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => handleNavClick(item.path)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
                )
              }
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {isFrequent && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <TrendingUp className="h-2.5 w-2.5" />
                      Frequent
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

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
            "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 w-full transition-colors",
            collapsed && "justify-center px-2",
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
