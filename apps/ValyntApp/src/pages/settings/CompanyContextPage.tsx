/**
 * CompanyContextPage
 *
 * Admin settings section for tenant company context.
 * Submits to POST /api/v1/tenant/context, which stores the data as
 * semantic memory entries used by agents during value case generation.
 */

import { Building2, Clock, Database, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { SettingsSection } from "@/components/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useIngestTenantContext,
  useTenantContextSummary,
  type TenantContextPayload,
} from "@/hooks/useTenantContext";

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function CompanyContextPage() {
  const { data: summary, isLoading } = useTenantContextSummary();
  const { mutate: ingest, isPending, isSuccess, error } = useIngestTenantContext();

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [icpDefinition, setIcpDefinition] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([""]);

  // Pre-fill from summary labels on first load
  useEffect(() => {
    if (summary?.labels?.length) {
      // Labels are stored as context_type tags — not editable fields.
      // Form starts empty so admin explicitly re-submits to update.
    }
  }, [summary]);

  const addCompetitor = () => setCompetitors((prev) => [...prev, ""]);
  const removeCompetitor = (i: number) =>
    setCompetitors((prev) => prev.filter((_, idx) => idx !== i));
  const updateCompetitor = (i: number, value: string) =>
    setCompetitors((prev) => prev.map((c, idx) => (idx === i ? value : c)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: TenantContextPayload = {
      websiteUrl: websiteUrl.trim() || undefined,
      productDescription: productDescription.trim(),
      icpDefinition: icpDefinition.trim(),
      competitorList: competitors.map((c) => c.trim()).filter(Boolean),
    };
    ingest(payload);
  };

  const hasContext = summary && summary.entryCount > 0;

  return (
    <div className="space-y-8">
      {/* Status banner */}
      <SettingsSection
        title="Company Context"
        description="Provide company information once. Agents use this context to pre-seed all future value cases with relevant background."
      >
        <div className="flex items-center gap-4 py-3 px-4 rounded-xl border border-zinc-200 bg-zinc-50">
          <Database className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="h-4 w-48 bg-zinc-200 rounded animate-pulse" />
            ) : hasContext ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-zinc-700 font-medium">
                  {summary.entryCount} memory {summary.entryCount === 1 ? "entry" : "entries"} stored
                </span>
                {summary.labels.slice(0, 4).map((label) => (
                  <Badge key={label} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-sm text-zinc-500">
                No context configured. Fill in the form below to get started.
              </span>
            )}
          </div>
          {hasContext && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 flex-shrink-0">
              <Clock className="w-3 h-3" />
              <span>Updated {formatDate(summary.lastIngestedAt)}</span>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <SettingsSection
          title="Company details"
          description="Basic information about your company used to ground agent reasoning."
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="websiteUrl">Company website URL</Label>
              <Input
                id="websiteUrl"
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="productDescription">
                Product / service description <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="productDescription"
                placeholder="Describe your core product or service, key capabilities, and the problems it solves…"
                rows={4}
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                required
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Ideal customer profile (ICP)"
          description="Describe the customers you target. Agents use this to tailor value hypotheses."
        >
          <div className="space-y-1.5">
            <Label htmlFor="icpDefinition">
              ICP definition <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="icpDefinition"
              placeholder="e.g. Mid-market B2B SaaS companies (200–2000 employees) in financial services with a dedicated RevOps function…"
              rows={4}
              value={icpDefinition}
              onChange={(e) => setIcpDefinition(e.target.value)}
              required
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Competitors"
          description="List key competitors. Agents reference these when building differentiation narratives."
        >
          <div className="space-y-2">
            {competitors.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder={`Competitor ${i + 1}`}
                  value={c}
                  onChange={(e) => updateCompetitor(i, e.target.value)}
                  className="flex-1"
                />
                {competitors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCompetitor(i)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                    aria-label="Remove competitor"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {competitors.length < 20 && (
              <button
                type="button"
                onClick={addCompetitor}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add competitor
              </button>
            )}
          </div>
        </SettingsSection>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            disabled={isPending || !productDescription.trim() || !icpDefinition.trim()}
          >
            <Building2 className="w-4 h-4 mr-1.5" />
            {isPending ? "Saving…" : hasContext ? "Update context" : "Save context"}
          </Button>

          {isSuccess && (
            <span className="text-sm text-emerald-600">
              ✅ Context saved — agents will use this for new cases.
            </span>
          )}

          {error && (
            <span className="text-sm text-rose-600">
              ❌ {error.message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export default CompanyContextPage;
