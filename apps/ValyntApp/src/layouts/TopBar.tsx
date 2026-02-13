import { Search, Bell, ChevronDown, Sparkles, Menu } from "lucide-react";
import { useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useCompanyValueContext } from "@/contexts/CompanyContextProvider";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigationPersonalization } from "@/hooks/useNavigationPersonalization";
import { NAV_LABEL_BY_PATH } from "@/layouts/navigationConfig";
import { cn } from "@/lib/utils";

interface TopBarProps {
  onMenuClick?: () => void;
  onAgentOpen?: () => void;
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "VO";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function TopBar({ onMenuClick, onAgentOpen }: TopBarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { companyContext } = useCompanyValueContext();

  const storageScope = user?.id ?? currentTenant?.id ?? "anon";
  const { recentSearches, frequentRoutePaths, recordSearch } = useNavigationPersonalization(storageScope);

  const orgName =
    companyContext?.context.company_name ||
    currentTenant?.name ||
    (typeof user?.user_metadata?.company_name === "string" ? user.user_metadata.company_name : null) ||
    "Your organization";

  const planLabel =
    (typeof user?.app_metadata?.plan === "string" && user.app_metadata.plan) ||
    (typeof user?.user_metadata?.plan === "string" && user.user_metadata.plan) ||
    (currentTenant?.role ? `${currentTenant.role} plan` : null) ||
    (companyContext?.context.company_size
      ? companyContext.context.company_size.replace("_", " ")
      : null) ||
    "Standard";

  const suggestedFocus = useMemo(() => {
    const topPath = frequentRoutePaths[0];
    return topPath ? NAV_LABEL_BY_PATH[topPath] : null;
  }, [frequentRoutePaths]);

  const searchPlaceholder = suggestedFocus
    ? `Search ${suggestedFocus.toLowerCase()}, models, agents...`
    : "Search opportunities, models, agents...";

  const submitSearch = () => {
    if (!searchValue.trim()) return;
    recordSearch(searchValue);
  };

  return (
    <header className="h-16 border-b border-zinc-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="lg:hidden p-1.5 rounded-lg hover:bg-zinc-100"
          >
            <Menu className="w-5 h-5 text-zinc-600" />
          </button>
        )}

        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
          <div className="w-6 h-6 bg-zinc-950 rounded flex items-center justify-center">
            <span className="text-white text-[10px] font-black">{getInitials(orgName)}</span>
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-[13px] font-semibold text-zinc-900 leading-tight">{orgName}</p>
            <p className="text-[10px] text-zinc-400 leading-tight capitalize">{planLabel}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 max-w-md mx-4 relative">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
            searchFocused ? "border-zinc-400 shadow-sm bg-white" : "border-zinc-200 bg-zinc-50",
          )}
        >
          <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <input
            type="text"
            value={searchValue}
            placeholder={searchPlaceholder}
            list="topbar-recent-searches"
            className="flex-1 bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 outline-none"
            onChange={(event) => setSearchValue(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              setSearchFocused(false);
              submitSearch();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitSearch();
              }
            }}
          />
          <datalist id="topbar-recent-searches">
            {recentSearches.map((query) => (
              <option key={query} value={query} />
            ))}
          </datalist>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-100 text-[10px] text-zinc-400 font-mono">
            /
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          aria-label="Open notifications"
          className="relative p-2 rounded-lg hover:bg-zinc-100 transition-colors"
        >
          <Bell className="w-[18px] h-[18px] text-zinc-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

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
