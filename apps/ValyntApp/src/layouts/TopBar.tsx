import { Search, Bell, ChevronDown, Sparkles, Menu } from "lucide-react";
import { KeyboardEvent, useMemo, useState } from "react";

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

function normalizePlanLabel(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "Standard";

  if (["enterprise", "enterprise_plan"].includes(normalized)) return "Enterprise";
  if (["mid_market", "growth", "pro"].includes(normalized)) return "Growth";
  if (["smb", "starter", "basic", "free"].includes(normalized)) return "Starter";

  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getInitials(name: string): string {
  const chunks = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (chunks.length === 0) return "VO";
  return chunks.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function TopBar({ onMenuClick, onAgentOpen }: TopBarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState("");

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

  const planLabel = useMemo(() => {
    const authMeta = user?.user_metadata as Record<string, unknown> | undefined;
    const metadata = companyContext?.context.metadata;

    const planFromCompanyMetadata =
      metadata && typeof metadata === "object" && typeof metadata.plan === "string"
        ? metadata.plan
        : null;

    const candidates = [
      planFromCompanyMetadata,
      companyContext?.context.company_size,
      currentTenant?.role,
      typeof authMeta?.plan === "string" ? authMeta.plan : null,
      typeof authMeta?.subscription_plan === "string" ? authMeta.subscription_plan : null,
    ];

    return normalizePlanLabel(candidates.find((entry) => typeof entry === "string" && entry.trim().length > 0));
  }, [companyContext?.context.company_size, companyContext?.context.metadata, currentTenant?.role, user?.user_metadata]);

  const orgInitials = getInitials(orgName);

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

  const submitSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    trackSearch(trimmed);
    trackFeatureUsage("search");
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      submitSearch();
    }
  };

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
        <button
          type="button"
          className="flex items-center gap-2 px-3 sm:px-4 min-h-11 rounded-xl hover:bg-zinc-100 transition-colors min-w-0"
        >
          <div className="w-7 h-7 bg-zinc-950 rounded flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-black">{orgInitials}</span>
          </div>
          <div className="text-left hidden sm:block min-w-0">
            <p className="text-[13px] font-semibold text-zinc-900 leading-tight truncate">
              {orgName}
            </p>
            <p className="text-[10px] text-zinc-400 leading-tight">{planLabel}</p>
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
            placeholder={personalizedPlaceholder}
            value={query}
            className="flex-1 bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 outline-none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              setSearchFocused(false);
              submitSearch();
            }}
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
          className="relative min-h-11 min-w-11 p-2.5 rounded-xl hover:bg-zinc-100 transition-colors inline-flex items-center justify-center"
        >
          <Bell className="w-[18px] h-[18px] text-zinc-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Agent quick action */}
        <button
          type="button"
          onClick={() => {
            trackFeatureUsage("ask_agent");
            onAgentOpen?.();
          }}
          className="flex items-center justify-center gap-2 px-3 sm:px-4 min-h-11 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Ask Agent</span>
        </button>
      </div>
    </header>
  );
}

