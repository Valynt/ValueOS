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
    <header className="h-16 border-b border-zinc-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: mobile menu + org/tenant switcher */}
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-lg hover:bg-zinc-100">
            <Menu className="w-5 h-5 text-zinc-600" />
          </button>
        )}

        {/* Org / Tenant switcher */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
          <div className="w-6 h-6 bg-zinc-950 rounded flex items-center justify-center">
            <span className="text-white text-[10px] font-black">AC</span>
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-[13px] font-semibold text-zinc-900 leading-tight">Acme Corp</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Enterprise</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>

      {/* Center: search */}
      <div className="flex-1 max-w-md mx-4">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
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
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-zinc-100 transition-colors">
          <Bell className="w-[18px] h-[18px] text-zinc-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Agent quick action */}
        <button
          onClick={onAgentOpen}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Ask Agent</span>
        </button>
      </div>
    </header>
  );
}
