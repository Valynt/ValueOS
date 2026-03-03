/*
 * Design: Atelier — Refined Workspace Craft
 * Sidebar: Near-black (#0A0A0A) with indigo active states
 * Collapsible, icon-only mode on collapse
 * Plus Jakarta Sans 500 for labels
 */
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Briefcase,
  Boxes,
  Bot,
  Plug,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/opportunities", label: "Opportunities", icon: Briefcase },
  { path: "/models", label: "Value Models", icon: Boxes },
  { path: "/agents", label: "Agent Hub", icon: Bot },
  { path: "/integrations", label: "Integrations", icon: Plug },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed } = useApp();

  const isActive = (path: string) => {
    if (path === "/dashboard") return location === "/" || location === "/dashboard";
    return location.startsWith(path);
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-200 relative border-r border-sidebar-border",
        sidebarCollapsed ? "w-[68px]" : "w-[256px]"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center w-full")}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-extrabold text-sm tracking-tighter">V</span>
          </div>
          {!sidebarCollapsed && (
            <span className="font-extrabold text-white tracking-[-0.04em] text-lg">VALYNT</span>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground z-10 shadow-sm transition-colors hidden lg:flex"
      >
        {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const linkContent = (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex items-center gap-3 px-3 h-10 rounded-xl text-[13px] font-medium transition-colors",
                sidebarCollapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-sidebar-foreground/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-sidebar-foreground truncate">Jane Doe</p>
              <p className="text-[11px] text-sidebar-foreground/40">Administrator</p>
            </div>
          </div>
        )}
        <button
          className={cn(
            "flex items-center gap-3 px-3 h-10 rounded-xl text-[13px] text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground/80 w-full transition-colors",
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
