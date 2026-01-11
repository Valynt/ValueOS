import { NavLink, useLocation } from "react-router-dom";
import {
  Calculator,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  LayoutGrid,
  LineChart,
  Map,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import UserProfileDropdown from "./UserProfileDropdown";
import AgentChatInterface from "../Agents/AgentChatInterface";
import { TenantSwitcher } from "./TenantSwitcher";
import { TenantBadge } from "./TenantBadge";

const navItems = [
  { icon: LayoutGrid, label: "Overview", path: "/" },
  { icon: Map, label: "Discovery", path: "/canvas" },
  { icon: Layers, label: "Architecture", path: "/cascade" },
  { icon: Calculator, label: "Economics", path: "/calculator" },
  { icon: LineChart, label: "Realization", path: "/dashboard" },
];

export default function UnifiedSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div
      className={`flex flex-col bg-black/20 backdrop-blur-xl border-r border-white/10 transition-all duration-300 h-screen relative ${
        isCollapsed ? "w-16" : "w-80"
      }`}
    >
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-16 w-6 h-6 bg-gray-900/80 backdrop-blur border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-gray-800 hover:border-white/20 transition-all shadow-lg z-10"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronsRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronsLeft className="w-3.5 h-3.5" />
        )}
      </button>

      <div className="h-14 flex items-center px-4 border-b border-white/5">
        <div className={`flex items-center ${isCollapsed ? "justify-center w-full" : "gap-2.5"}`}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-sm text-white shadow-glow-teal flex-shrink-0">
            V
          </div>
          {!isCollapsed && (
            <span className="font-bold text-lg tracking-tight text-white">ValueOS</span>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-3 border-b border-white/5">
          <div className="text-[9px] uppercase tracking-widest font-semibold text-slate-500 mb-2 px-1">
            Current Tenant
          </div>
          <TenantSwitcher />
        </div>
      )}

      {isCollapsed && (
        <div className="p-2 border-b border-white/5 flex justify-center">
          <TenantBadge showName={false} size="lg" />
        </div>
      )}

      <div className="py-3 px-2 space-y-1 border-b border-white/5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl text-sm transition-all duration-200 relative ${
                isCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
              } ${
                isActive
                  ? "bg-primary/10 text-white"
                  : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
              }`}
            >
              <item.icon
                className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-primary" : ""}`}
              />
              {!isCollapsed && <span className="font-medium">{item.label}</span>}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full bg-primary" />
              )}
            </NavLink>
          );
        })}
      </div>

      {!isCollapsed && (
        <div className="flex-1 flex flex-col min-h-0 bg-black/10">
          <div className="px-3 py-2.5 border-b border-white/5 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Agent Co-Pilot
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <AgentChatInterface compact currentPath={location.pathname} />
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center py-4">
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2.5 rounded-xl hover:bg-white/5 text-neutral-400 hover:text-primary transition-all"
            title="Open Agent Co-Pilot"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="p-3 border-t border-white/5 mt-auto">
        <UserProfileDropdown isExpanded={!isCollapsed} />
      </div>
    </div>
  );
}
