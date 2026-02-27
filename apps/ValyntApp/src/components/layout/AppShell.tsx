/**
 * AppShell - Main application layout
 * 
 * Dark sidebar with navigation, light content area.
 * Based on ValueOS UX design spec.
 */

import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bell,
  Briefcase,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Home,
  Library,
  Search,
  Settings,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/avatar";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}

const NavItem = ({ to, icon, label, end }: NavItemProps) => {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-white"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
};

interface NavItemWithSubmenuProps {
  icon: React.ReactNode;
  label: string;
  basePath: string;
  children: { to: string; icon: React.ReactNode; label: string }[];
}

const NavItemWithSubmenu = ({ icon, label, basePath, children }: NavItemWithSubmenuProps) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(basePath);
  const [isOpen, setIsOpen] = useState(isActive);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-slate-800 text-white"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        )}
      >
        <div className="flex items-center gap-3">
          {icon}
          <span>{label}</span>
        </div>
        <ChevronRight
          size={16}
          className={cn("transition-transform", isOpen && "rotate-90")}
        />
      </button>
      {isOpen && (
        <div className="ml-4 mt-1 space-y-1 border-l border-slate-700 pl-3">
          {children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )
              }
            >
              {child.icon}
              <span>{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

export function AppShell() {
  const location = useLocation();

  // Get breadcrumb info from route
  const getBreadcrumb = () => {
    const path = location.pathname;
    
    if (path === "/app" || path === "/app/") return null; // Home doesn't show breadcrumb
    
    if (path.includes("/cases/new")) {
      return { parent: "Cases", parentPath: "/app/cases", current: "New Case" };
    }
    if (path.includes("/cases/")) {
      return { parent: "Cases", parentPath: "/app/cases", current: "Case Details" };
    }
    if (path === "/app/cases") {
      return { parent: "Platform", current: "Cases" };
    }
    if (path === "/app/library/templates") {
      return { parent: "Library", parentPath: "/app/library", current: "Templates" };
    }
    if (path === "/app/library/drivers") {
      return { parent: "Library", parentPath: "/app/library", current: "Value Drivers" };
    }
    if (path === "/app/library") {
      return { parent: "Platform", current: "Library" };
    }
    if (path === "/app/team") {
      return { parent: "Organization", current: "Team Members" };
    }
    if (path === "/app/billing") {
      return { parent: "Organization", current: "Usage & Billing" };
    }
    if (path.startsWith("/app/settings")) {
      return null; // Settings has its own header
    }
    
    return null;
  };

  const breadcrumb = getBreadcrumb();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-800">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
            V
          </div>
          <span className="font-semibold text-white text-lg">ValueOS</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {/* Platform Section */}
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Platform
          </div>
          <NavItem to="/app" icon={<Home size={18} />} label="Home" end />
          <NavItem to="/app/cases" icon={<Briefcase size={18} />} label="Cases" />
          <NavItemWithSubmenu
            icon={<Library size={18} />}
            label="Library"
            basePath="/app/library"
            children={[
              { to: "/app/library/templates", icon: <FileText size={14} />, label: "Templates" },
              { to: "/app/library/drivers", icon: <Target size={14} />, label: "Value Drivers" },
            ]}
          />

          {/* Organization Section */}
          <div className="px-3 py-2 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Organization
          </div>
          <NavItem to="/app/team" icon={<Users size={18} />} label="Team" />
          <NavItem to="/app/billing" icon={<CreditCard size={18} />} label="Billing" />
          <NavItem to="/app/settings" icon={<Settings size={18} />} label="Settings" />
        </nav>

        {/* User Menu */}
        <div className="p-4 border-t border-slate-800">
          <NavLink
            to="/app/settings/profile"
            className="w-full flex items-center gap-3 hover:bg-slate-800 rounded-lg p-2 transition-colors"
          >
            <UserAvatar
              name="Sarah K."
              size="sm"
              className="ring-2 ring-primary"
            />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-white">Sarah K.</div>
              <div className="text-xs text-slate-400">Acme Corp</div>
            </div>
            <ChevronDown size={16} className="text-slate-400" />
          </NavLink>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - only show for non-home pages */}
        {breadcrumb && (
          <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6">
            <div className="flex items-center gap-2 text-sm">
              {breadcrumb.parentPath ? (
                <NavLink to={breadcrumb.parentPath} className="text-slate-500 hover:text-slate-700">
                  {breadcrumb.parent}
                </NavLink>
              ) : (
                <span className="text-slate-500">{breadcrumb.parent}</span>
              )}
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">{breadcrumb.current}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search (⌘K)"
                  className="pl-9 pr-4 py-1.5 w-64 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
            </div>
          </header>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppShell;
