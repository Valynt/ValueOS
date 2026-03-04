/*
 * VALYNT TopBar — Org switcher, centered search, notifications, Ask Agent (opens sidebar panel)
 * Typography standardized to 12px+ minimum
 */
import { useState } from "react";
import { Search, Bell, Sparkles, ChevronDown, Check } from "lucide-react";
import { tenants, currentOrg, notifications } from "@/lib/data";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopBarProps {
  onOpenAgent: () => void;
}

export function TopBar({ onOpenAgent }: TopBarProps) {
  const [selectedTenant, setSelectedTenant] = useState(currentOrg.id);
  const current = tenants.find((t) => t.id === selectedTenant) || tenants[0];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="h-14 border-b border-border bg-background flex items-center px-5 gap-4">
      {/* Org Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 hover:bg-accent rounded-lg px-2 py-1.5 transition-colors outline-none">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {current.initials}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground leading-tight">{current.name}</p>
            <p className="text-xs text-muted-foreground leading-tight">{current.plan}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {tenants.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setSelectedTenant(t.id)}
              className="flex items-center gap-3 py-2"
            >
              <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {t.initials}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.plan}</p>
              </div>
              {t.id === selectedTenant && <Check className="w-3.5 h-3.5 text-emerald-600" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search cases, models, agents..."
            className="w-full h-9 pl-9 pr-10 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono border border-border rounded px-1.5 py-0.5">/</kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative w-9 h-9 rounded-lg flex items-center justify-center hover:bg-accent transition-colors outline-none">
            <Bell className="w-[18px] h-[18px] text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-3 py-2 border-b">
              <p className="text-sm font-semibold">Notifications</p>
            </div>
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />}
                    <p className="text-sm font-medium">{n.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-3.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground/60 pl-3.5">{n.timestamp}</p>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Ask Agent — opens sidebar panel, not a page */}
        <button
          onClick={onOpenAgent}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Ask Agent
        </button>
      </div>
    </header>
  );
}
