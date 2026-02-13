import { Search, Bell, ChevronDown, Sparkles, Menu, Building2 } from "lucide-react";
import { KeyboardEvent, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";
import { useCompanyValueContext } from "@/contexts/CompanyContextProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationPersonalization } from "@/hooks/useNavigationPersonalization";

interface TopBarProps {
  onMenuClick?: () => void;
  onAgentOpen?: () => void;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  standard: "Standard",
  enterprise: "Enterprise",
};

export function TopBar({ onMenuClick, onAgentOpen }: TopBarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { companyContext } = useCompanyValueContext();

  const personalizationScope = `${user?.id ?? "anonymous"}:${currentTenant?.id ?? "default"}`;
  const { state, recordFeatureUsage, recordSearch } =
    useNavigationPersonalization(personalizationScope);

  const organizationName =
    companyContext?.context.company_name ||
    currentTenant?.name ||
    user?.user_metadata?.org_name ||
    "Your workspace";

  const planTierFromMetadata =
    (typeof user?.user_metadata?.plan_tier === "string" && user.user_metadata.plan_tier) ||
    (typeof user?.app_metadata?.plan_tier === "string" && user.app_metadata.plan_tier) ||
    companyContext?.context.company_size ||
    undefined;

  const planLabel =
    (planTierFromMetadata && PLAN_LABELS[planTierFromMetadata.toLowerCase()]) ||
    (companyContext?.context.company_size
      ? companyContext.context.company_size.replace("_", " ")
      : "Starter");

  const tenantInitials = useMemo(() => {
    const raw = organizationName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase())
      .join("");
    return raw || "VW";
  }, [organizationName]);

  const searchPlaceholder =
    state.recentSearches[0] && state.recentSearches[1]
      ? `Search again: ${state.recentSearches[0]} · ${state.recentSearches[1]}`
      : state.recentSearches[0]
        ? `Search again: ${state.recentSearches[0]}`
        : `Search ${organizationName}, opportunities, models...`;

  const recentSuggestions = state.recentSearches.slice(0, 3);

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    recordSearch(searchQuery);
    setSearchQuery("");
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearchSubmit();
    }
  };

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
            <span className="text-white text-[10px] font-black">{tenantInitials}</span>
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-[13px] font-semibold text-zinc-900 leading-tight">
              {organizationName}
            </p>
            <p className="text-[10px] text-zinc-400 leading-tight">{planLabel}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>

      {/* Center: search */}
      <div className="flex-1 max-w-md mx-4">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
            searchFocused ? "border-zinc-400 shadow-sm bg-white" : "border-zinc-200 bg-zinc-50"
          )}
        >
          <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            className="flex-1 bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 outline-none"
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => {
              setSearchFocused(true);
              recordFeatureUsage("topbar-search-focus");
            }}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={handleSearchKeyDown}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-100 text-[10px] text-zinc-400 font-mono">
            /
          </kbd>
        </div>
        {recentSuggestions.length > 0 && (
          <div className="mt-1 hidden md:flex items-center gap-2 text-[11px] text-zinc-400">
            <Building2 className="w-3.5 h-3.5" />
            <span>Recent:</span>
            {recentSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setSearchQuery(suggestion);
                  recordFeatureUsage("topbar-search-suggestion");
                }}
                className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-500"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
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
          onClick={() => {
            onAgentOpen?.();
            recordFeatureUsage("topbar-ask-agent");
          }}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Ask Agent</span>
        </button>
      </div>
    </header>
  );
}
