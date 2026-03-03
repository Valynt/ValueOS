/*
 * VALYNT Sidebar — Matches reference screenshots exactly
 * White bg, black active item, nav: Cases, My Work, Models, Agents, Company Intel, Settings
 * User at bottom with email + role + Sign Out
 */
import { useLocation, Link } from "wouter";
import {
  LayoutGrid,
  Zap,
  Boxes,
  Bot,
  Building2,
  Settings,
  LogOut,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/cases", label: "Cases", icon: LayoutGrid, hot: true },
  { path: "/my-work", label: "My Work", icon: Zap, hot: true },
  { path: "/models", label: "Models", icon: Boxes },
  { path: "/agents", label: "Agents", icon: Bot },
  { path: "/company-intel", label: "Company Intel", icon: Building2 },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/cases") return location === "/" || location === "/cases" || location.startsWith("/opportunities");
    return location.startsWith(path);
  };

  return (
    <aside className="flex flex-col h-full w-[220px] bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 gap-2.5">
        <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-extrabold text-xs">V</span>
        </div>
        <span className="font-extrabold text-foreground tracking-[-0.03em] text-base">VALYNT</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-2 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex items-center gap-3 px-3 h-10 rounded-lg text-[13.5px] font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              <span className="flex-1">{item.label}</span>
              {item.hot && (
                <span className={cn(
                  "flex items-center gap-1 text-[10px] font-semibold",
                  active ? "text-sidebar-primary-foreground/70" : "text-muted-foreground"
                )}>
                  <Zap className="w-3 h-3" />
                  HOT
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-3 pt-2 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">brian@me.com</p>
            <p className="text-[11px] text-muted-foreground">Admin</p>
          </div>
        </div>
        <button className="flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground w-full transition-colors">
          <LogOut className="w-[16px] h-[16px]" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
