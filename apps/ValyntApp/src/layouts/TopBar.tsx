import { Bell, Menu, Search, Sparkles } from "lucide-react";
import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { TenantSwitcher } from "@/components/tenant/TenantSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyValueContext } from "@/contexts/CompanyContextProvider";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigationPersonalization } from "@/hooks/useNavigationPersonalization";
import { cn } from "@/lib/utils";

interface TopBarProps {
  onMenuClick?: () => void;
  onAgentOpen?: () => void;
}

const DEFAULT_SEARCH_PLACEHOLDER = "Search opportunities, models, agents...";


export function TopBar({ onMenuClick, onAgentOpen }: TopBarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { companyContext } = useCompanyValueContext();
  const { recentSearches, trackSearch, trackFeatureUsage } = useNavigationPersonalization();

  const orgName = useMemo(() => {
    const authMeta = user?.user_metadata as Record<string, unknown> | undefined;

    const candidates = [
      companyContext?.context.company_name,
      currentTenant?.name,
      typeof authMeta?.organization_name === "string" ? authMeta.organization_name : null,
      typeof authMeta?.org_name === "string" ? authMeta.org_name : null,
      typeof authMeta?.company_name === "string" ? authMeta.company_name : null,
    ];

    return candidates.find((entry) => typeof entry === "string" && entry.trim().length > 0)?.trim() ?? "Value Org";
  }, [companyContext?.context.company_name, currentTenant?.name, user?.user_metadata]);


  // orgInitials removed — TenantSwitcher handles its own initials

  const personalizedPlaceholder = useMemo(() => {
    const recent = recentSearches[0];
    if (recent) return `Continue with "${recent}"`;

    if (companyContext?.context.industry) {
      return `Search ${companyContext.context.industry} opportunities, models, agents...`;
    }

    if (orgName !== "Value Org") {
      return `Search in ${orgName} workspace...`;
    }

    return DEFAULT_SEARCH_PLACEHOLDER;
  }, [companyContext?.context.industry, orgName, recentSearches]);

  const recentSuggestions = useMemo(() => {
    return recentSearches.slice(0, 3);
  }, [recentSearches]);

  const submitSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    trackSearch(trimmed);
    trackFeatureUsage("search");
    navigate(`/app/cases?q=${encodeURIComponent(trimmed)}`);
  }, [query, trackSearch, trackFeatureUsage, navigate]);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      submitSearch();
    } else if (event.key === "Escape") {
      searchRef.current?.blur();
    }
  };

  // Focus search on `/` keypress (when not already in an input)
  useEffect(() => {
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        event.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !(document.activeElement as HTMLElement)?.isContentEditable
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  return (
    <header className="h-14 border-b border-zinc-100 bg-white/95 backdrop-blur-sm flex items-center justify-between px-3 sm:px-4 lg:px-6 gap-2 sm:gap-4 flex-shrink-0 overflow-x-clip">
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
        <TenantSwitcher />

        {/* Tenant badge */}
        {currentTenant && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-100 bg-zinc-50 text-[11px] text-zinc-500 font-medium">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: currentTenant.color || "#18C3A5" }}
            />
            <span className="truncate max-w-[6rem]">{currentTenant.name}</span>
          </div>
        )}
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
            ref={searchRef}
            type="text"
            placeholder={personalizedPlaceholder}
            value={query}
            className="flex-1 bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 outline-none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-100 text-[10px] text-zinc-400 font-mono">
            /
          </kbd>
        </div>

        {recentSuggestions.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 mt-1 text-[11px] text-zinc-400 overflow-hidden">
            <span>Recent:</span>
            {recentSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="px-2 py-0.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 truncate max-w-[8rem]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery(suggestion);
                  trackSearch(suggestion);
                  trackFeatureUsage("search");
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Notifications */}
        <button
          aria-label="Open notifications"
          onClick={() => trackFeatureUsage("notifications")}
          className="relative min-h-9 min-w-9 p-2 rounded-xl hover:bg-zinc-100 transition-colors inline-flex items-center justify-center"
        >
          <Bell className="w-[17px] h-[17px] text-zinc-400" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* Agent quick action */}
        <button
          type="button"
          onClick={() => {
            trackFeatureUsage("ask_agent");
            onAgentOpen?.();
          }}
          className="flex items-center justify-center gap-2 px-3 sm:px-4 h-9 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all duration-150 whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ask Agent</span>
        </button>
      </div>
    </header>
  );
}

