import { Search, Bell, ChevronDown, Sparkles, Menu } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface TopBarProps {
  onMenuClick?: () => void;
  onAgentOpen?: () => void;
}

export function TopBar({ onMenuClick, onAgentOpen }: TopBarProps) {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="h-16 border-b border-zinc-200 bg-white flex items-center justify-between px-3 sm:px-4 lg:px-6 gap-2 sm:gap-4 flex-shrink-0 overflow-x-clip">
      {/* Left: mobile menu + org/tenant switcher */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="lg:hidden min-h-11 min-w-11 p-2.5 rounded-xl hover:bg-zinc-100 transition-colors inline-flex items-center justify-center flex-shrink-0"
          >
            <Menu className="w-5 h-5 text-zinc-600" />
          </button>
        )}

        {/* Org / Tenant switcher */}
        <button className="flex items-center gap-2 px-3 sm:px-4 min-h-11 rounded-xl hover:bg-zinc-100 transition-colors min-w-0">
          <div className="w-7 h-7 bg-zinc-950 rounded flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-black">AC</span>
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-[13px] font-semibold text-zinc-900 leading-tight">Acme Corp</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Enterprise</p>
          </div>
          <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        </button>
      </div>

      {/* Center: search */}
      <div className="hidden md:block flex-1 max-w-md mx-2 lg:mx-4 min-w-0">
        <div
          className={cn(
            "flex items-center gap-2 px-3 min-h-11 rounded-xl border transition-all",
            searchFocused
              ? "border-zinc-400 shadow-sm bg-white"
              : "border-zinc-200 bg-zinc-50"
          )}
        >
          <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search opportunities, models, agents..."
            className="flex-1 bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 outline-none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-100 text-[10px] text-zinc-400 font-mono">
            /
          </kbd>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Notifications */}
        <button
          aria-label="Open notifications"
          className="relative min-h-11 min-w-11 p-2.5 rounded-xl hover:bg-zinc-100 transition-colors inline-flex items-center justify-center"
        >
          <Bell className="w-[18px] h-[18px] text-zinc-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Agent quick action */}
        <button
          onClick={onAgentOpen}
          className="flex items-center justify-center gap-2 px-3 sm:px-4 min-h-11 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Ask Agent</span>
        </button>
      </div>
    </header>
  );
}
