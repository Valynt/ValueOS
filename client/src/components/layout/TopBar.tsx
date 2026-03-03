/*
 * Design: Atelier — Refined Workspace Craft
 * TopBar: Warm white, tenant switcher, global search, notifications, "Ask Agent" CTA
 */
import { useState } from "react";
import { Bell, Search, Sparkles, ChevronDown, Check, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const {
    org,
    currentTenant,
    setCurrentTenant,
    tenantList,
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    setAgentChatOpen,
  } = useApp();
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 gap-4 flex-shrink-0">
      {/* Left: mobile menu + tenant switcher */}
      <div className="flex items-center gap-3 min-w-0">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
        )}

        {/* Org / Tenant switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: currentTenant.color }}
              >
                {currentTenant.name.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[13px] font-semibold text-foreground leading-tight">{currentTenant.name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{org.name}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Active Tenant
            </DropdownMenuLabel>
            {tenantList.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => setCurrentTenant(t)}
                className="flex items-center gap-2"
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ backgroundColor: t.color }}
                >
                  {t.name.charAt(0)}
                </div>
                <span className="flex-1">{t.name}</span>
                {t.id === currentTenant.id && <Check className="w-4 h-4 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Organization
            </DropdownMenuLabel>
            <DropdownMenuItem disabled>
              <span className="text-[12px]">{org.name}</span>
              <Badge variant="secondary" className="ml-auto text-[10px] capitalize">{org.tier}</Badge>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Center: search */}
      <div className="hidden md:block flex-1 max-w-md mx-4">
        <div
          className={cn(
            "flex items-center gap-2 px-3 h-10 rounded-xl border transition-all",
            searchFocused ? "border-ring shadow-sm bg-card" : "border-border bg-muted/50"
          )}
        >
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search opportunities, models, agents..."
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono">
            /
          </kbd>
        </div>
      </div>

      {/* Right: notifications + agent */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative p-2 rounded-xl hover:bg-muted transition-colors">
              <Bell className="w-[18px] h-[18px] text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-destructive rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors",
                    !n.read && "bg-accent/30"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                        n.type === "veto" ? "bg-destructive" :
                        n.type === "failure" ? "bg-amber-500" :
                        n.type === "success" ? "bg-emerald-500" :
                        n.type === "checkpoint" ? "bg-primary" :
                        "bg-muted-foreground"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{n.title}</p>
                      <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Ask Agent button */}
        <button
          onClick={() => setAgentChatOpen(true)}
          className="flex items-center gap-2 px-4 h-10 bg-primary text-primary-foreground rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Ask Agent</span>
        </button>
      </div>
    </header>
  );
}
