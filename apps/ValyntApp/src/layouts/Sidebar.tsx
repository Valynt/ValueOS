import { NavLink } from "react-router-dom";
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
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

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

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-zinc-200 h-full bg-white transition-all duration-200 relative",
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
            className="lg:hidden min-h-11 min-w-11 p-2 rounded-md hover:bg-zinc-100 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        )}
      </div>

      {/* Collapse toggle (desktop) */}
      {!onClose && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[4.5rem] min-w-11 min-h-11 px-2 py-2 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 z-10 hidden lg:flex shadow-sm"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 sm:px-3 py-4 space-y-1 overflow-x-hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors",
                collapsed && "justify-center px-2 py-2",
                isActive
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              )
            }
          >
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
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
          className={cn(
            "flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-xl text-[13px] text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 w-full transition-colors",
            collapsed && "justify-center px-2 py-2"
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
