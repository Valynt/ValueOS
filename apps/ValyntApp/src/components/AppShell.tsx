/**
 * AppShell
 *
 * Application layout with sidebar navigation, breadcrumbs, and search.
 *
 * UX Principles:
 * - POLA: consistent active states, predictable navigation icons
 * - Minimize Cognitive Load: collapsible sidebar, clean breadcrumbs
 * - Accessibility: skip-to-content link, keyboard shortcuts, aria landmarks
 * - 5-Second Rule: breadcrumbs answer "Where am I?", nav answers "What can I do?"
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Briefcase,
  ChevronRight,
  FileText,
  Home,
  Library,
  PanelLeft,
  PanelLeftClose,
  Search,
  Settings,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/deals", label: "Deals", icon: Briefcase },
  { to: "/drivers", label: "Value Drivers", icon: Library },
  { to: "/benchmarks", label: "Benchmarks", icon: BarChart3 },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/insights", label: "Insights", icon: Target },
  { to: "/admin", label: "Admin", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

function isActiveRoute(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(to + "/");
}

const AppShell: React.FC = () => {
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Keyboard shortcut: "/" to focus search, "[" to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !isInput) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "[" && !e.ctrlKey && !e.metaKey && !isInput) {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const skipToContent = useCallback(() => {
    mainRef.current?.focus();
  }, []);

  const breadcrumbs = location.pathname
    .split("/")
    .filter(Boolean)
    .map((crumb, i, arr) => ({
      label: crumb.charAt(0).toUpperCase() + crumb.slice(1).replace(/-/g, " "),
      to: "/" + arr.slice(0, i + 1).join("/"),
    }));

  const currentPageLabel =
    navItems.find((item) => isActiveRoute(location.pathname, item.to))?.label ?? "Home";

  return (
    <div className="flex h-screen bg-background">
      {/* Skip to content link (a11y) */}
      <a
        href="#main-content"
        onClick={(e) => { e.preventDefault(); skipToContent(); }}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {/* Sidebar */}
      <nav
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-200",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
        aria-label="Main navigation"
      >
        {/* Logo / Brand */}
        <div className={cn(
          "flex items-center border-b border-border h-16 shrink-0",
          sidebarCollapsed ? "justify-center px-2" : "px-4"
        )}>
          {!sidebarCollapsed && (
            <h1 className="text-lg font-bold text-foreground tracking-tight">ValueOS</h1>
          )}
          <button
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className={cn(
              "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !sidebarCollapsed && "ml-auto"
            )}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={`${sidebarCollapsed ? "Expand" : "Collapse"} sidebar ([)`}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Nav items */}
        <ul className="flex-1 py-2 space-y-0.5 px-2 overflow-y-auto" role="list">
          {navItems.map((item) => {
            const active = isActiveRoute(location.pathname, item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    sidebarCollapsed ? "justify-center p-2.5" : "px-3 py-2",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  aria-current={active ? "page" : undefined}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className={cn("shrink-0", sidebarCollapsed ? "h-5 w-5" : "h-4 w-4")} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between h-16 shrink-0 border-b border-border bg-card px-6">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-sm">
              <li>
                <Link
                  to="/"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Home
                </Link>
              </li>
              {breadcrumbs.map((crumb, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                  {i === breadcrumbs.length - 1 ? (
                    <span className="font-medium text-foreground" aria-current="page">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.to}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search... (/)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-56 rounded-md border border-border bg-secondary/50 pl-9 pr-3 py-2 text-sm",
                "placeholder:text-muted-foreground text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background",
                "transition-colors"
              )}
              aria-label="Global search"
            />
          </div>
        </header>

        {/* Main content */}
        <main
          ref={mainRef}
          id="main-content"
          className="flex-1 overflow-auto p-6 focus:outline-none"
          tabIndex={-1}
          role="main"
          aria-label={currentPageLabel}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
