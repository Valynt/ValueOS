/**
 * CRMSelector
 *
 * Lets users search and select a Salesforce opportunity to link to a value case.
 * Triggers the OAuth PKCE flow if no CRM connection exists, then fetches
 * opportunities from the connected provider.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/api/client/unified-api-client";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CrmOpportunity {
  externalId: string;
  name: string;
  amount: number | null;
  currency: string;
  stage: string;
  probability: number | null;
  closeDate: string | null;
  companyName?: string | null;
}

export interface CRMSelectorProps {
  /** Called when the user confirms an opportunity selection. */
  onSelect: (opportunity: CrmOpportunity) => void;
  /** Currently linked opportunity (pre-selects the row). */
  selectedId?: string;
  /** Restrict to a specific provider. Defaults to "salesforce". */
  provider?: "salesforce" | "hubspot";
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

function useCrmOpportunities(provider: string) {
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      const res = await api.get(`/api/crm/${provider}/status`);
      const data = res.data as Record<string, unknown>;
      setIsConnected(
        (data?.salesforce as Record<string, unknown>)?.connected === true ||
        (data?.hubspot as Record<string, unknown>)?.connected === true ||
        (data as Record<string, unknown>)?.connected === true,
      );
    } catch {
      setIsConnected(false);
    }
  }, [provider]);

  const fetchOpportunities = useCallback(async (query?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ provider });
      if (query) params.set("q", query);
      const res = await api.get(`/api/crm/${provider}/opportunities?${params.toString()}`);
      const data = res.data as Record<string, unknown>;
      setOpportunities((data?.opportunities as CrmOpportunity[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch opportunities");
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  const startOAuth = useCallback(async () => {
    try {
      const res = await api.post(`/api/crm/${provider}/connect/start`, {});
      const data = res.data as Record<string, unknown>;
      const authUrl = data?.authUrl as string;
      if (authUrl) {
        // Open OAuth popup — the callback page posts a message back.
        const popup = window.open(authUrl, "crm-oauth", "width=600,height=700");
        return popup;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start OAuth");
    }
    return null;
  }, [provider]);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (isConnected) {
      void fetchOpportunities();
    }
  }, [isConnected, fetchOpportunities]);

  return { opportunities, isLoading, error, isConnected, fetchOpportunities, startOAuth };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CRMSelector({
  onSelect,
  selectedId,
  provider = "salesforce",
  className,
}: CRMSelectorProps) {
  const { opportunities, isLoading, error, isConnected, fetchOpportunities, startOAuth } =
    useCrmOpportunities(provider);

  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        void fetchOpportunities(value);
      }, 300);
    },
    [fetchOpportunities],
  );

  // Listen for OAuth popup completion
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "crm-oauth-success") {
        void fetchOpportunities();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [fetchOpportunities]);

  if (isConnected === null) {
    return (
      <div className={cn("flex items-center justify-center h-24 text-muted-foreground text-sm", className)}>
        Checking CRM connection…
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={cn("flex flex-col items-center gap-4 py-8", className)}>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Connect your {provider === "salesforce" ? "Salesforce" : "HubSpot"} account to import
          opportunities directly into value cases.
        </p>
        <button
          type="button"
          onClick={() => void startOAuth()}
          className="px-4 py-2 rounded-xl bg-[#18C3A5] text-white text-sm font-semibold hover:bg-[#15b096] transition-colors"
        >
          Connect {provider === "salesforce" ? "Salesforce" : "HubSpot"}
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Search */}
      <input
        type="search"
        placeholder="Search opportunities…"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18C3A5]/40"
      />

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 px-1">{error}</p>
      )}

      {/* List */}
      <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">
            Loading…
          </div>
        )}

        {!isLoading && opportunities.length === 0 && (
          <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">
            No opportunities found
          </div>
        )}

        {!isLoading &&
          opportunities.map((opp) => {
            const isSelected = opp.externalId === selectedId;
            const isHovered = opp.externalId === highlighted;

            return (
              <button
                key={opp.externalId}
                type="button"
                onClick={() => onSelect(opp)}
                onMouseEnter={() => setHighlighted(opp.externalId)}
                onMouseLeave={() => setHighlighted(null)}
                className={cn(
                  "flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                  isSelected
                    ? "bg-[#18C3A5]/10 border border-[#18C3A5]/30"
                    : isHovered
                    ? "bg-surface border border-border"
                    : "border border-transparent",
                )}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">{opp.name}</span>
                  {opp.companyName && (
                    <span className="text-xs text-muted-foreground truncate">{opp.companyName}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{opp.stage}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {formatCurrency(opp.amount, opp.currency)}
                  </span>
                  {opp.probability != null && (
                    <span className="text-xs text-muted-foreground">{opp.probability}%</span>
                  )}
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
