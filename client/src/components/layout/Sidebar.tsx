/*
 * VALYNT Sidebar — Clean navigation with consistent 8pt spacing.
 * Integrates with useAuth for real user data and logout.
 * Nav items: Home, Cases, Models, Agents, Company Intel, Strategy, Settings.
 */
import { useLocation, Link } from "wouter";
import {
  Home,
  LayoutGrid,
  Boxes,
  Bot,
  Building2,
  Settings,
  FileText,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ── Navigation Config ── */

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  matchExact?: boolean;
}

const navItems: NavItem[] = [
  { path: "/", label: "Home", icon: Home, matchExact: true },
  { path: "/cases", label: "Cases", icon: LayoutGrid },
  { path: "/models", label: "Models", icon: Boxes },
  { path: "/agents", label: "Agents", icon: Bot },
  { path: "/company-intel", label: "Company Intel", icon: Building2 },
  { path: "/strategy", label: "Strategy", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
];

/* ── Sidebar Component ── */

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (item: NavItem) => {
    if (item.matchExact) return location === "/" || location === "/dashboard";
    if (item.path === "/cases") return location === "/cases" || location.startsWith("/cases/") || location.startsWith("/opportunities");
    return location.startsWith(item.path);
  };

  const displayName = user?.name || user?.email || "User";
  const displayRole = user?.role || "Member";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200",
          collapsed ? "w-[68px]" : "w-[220px]"
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-5 gap-2.5">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-extrabold text-xs">V</span>
          </div>
          {!collapsed && (
            <span className="font-extrabold text-foreground tracking-[-0.03em] text-base">
              VALYNT
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-2 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            const link = (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 h-10 rounded-lg text-sm font-medium transition-all duration-150",
                  collapsed ? "justify-center px-0" : "px-3",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon
                  className="w-[18px] h-[18px] flex-shrink-0"
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return link;
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="px-3 py-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full h-8 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* User footer */}
        <div className="px-3 pb-3 pt-2 border-t border-sidebar-border">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center py-2">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-xs font-semibold text-muted-foreground">{initials}</span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p className="font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground capitalize">{displayRole}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-muted-foreground">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{displayRole}</p>
                </div>
              </div>
              <button
                onClick={() => logout()}
                className="flex items-center gap-3 px-3 h-9 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground w-full transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
