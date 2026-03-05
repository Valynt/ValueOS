/*
 * VALYNT Sidebar — Clean navigation with 8pt spacing
 * Home (Dashboard), Cases, Models, Agents, Company Intel, Settings
 * Active state: filled bg, bold weight. Hover: subtle accent.
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Home", icon: Home, matchExact: true },
  { path: "/cases", label: "Cases", icon: LayoutGrid },
  { path: "/models", label: "Models", icon: Boxes },
  { path: "/agents", label: "Agents", icon: Bot },
  { path: "/company-intel", label: "Company Intel", icon: Building2 },
  { path: "/strategy", label: "Strategy", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  const isActive = (item: typeof navItems[0]) => {
    if (item.matchExact) return location === "/" || location === "/dashboard";
    if (item.path === "/cases") return location === "/cases" || location.startsWith("/cases/") || location.startsWith("/opportunities");
    return location.startsWith(item.path);
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
      <nav className="flex-1 px-3 pt-2 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              <span className="flex-1">{item.label}</span>
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
            <p className="text-sm font-medium text-foreground truncate">brian@me.com</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
        </div>
        <button className="flex items-center gap-3 px-3 h-9 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground w-full transition-colors">
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
