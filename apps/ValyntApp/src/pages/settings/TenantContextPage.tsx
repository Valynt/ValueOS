/**
 * TenantContextPage — /settings/tenant-context
 *
 * Allows admins to configure company context (products, ICPs, competitors,
 * personas, website URL) that is ingested into tenant-scoped semantic memory
 * via POST /api/v1/tenant/context.
 *
 * Access: admin role only. Non-admins are redirected to /dashboard by the
 * PermissionRoute guard wrapping this route.
 */

import { Building2 } from "lucide-react";
import { useState } from "react";

import { apiClient } from "@/api/client/unified-api-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantContextPayload {
  products: string[];
  icps: string[];
  competitors: string[];
  personas: string[];
  websiteUrl?: string;
}

interface IngestResponse {
  memoryEntries: number;
  status: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split a newline-separated textarea value into a trimmed, non-empty array. */
function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TenantContextPage() {
  const { toast } = useToast();

  const [products, setProducts] = useState("");
  const [icps, setIcps] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [personas, setPersonas] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload: TenantContextPayload = {
      products: parseLines(products),
      icps: parseLines(icps),
      competitors: parseLines(competitors),
      personas: parseLines(personas),
      ...(websiteUrl.trim() ? { websiteUrl: websiteUrl.trim() } : {}),
    };

    setSubmitting(true);
    try {
      const res = await apiClient.post<IngestResponse>(
        "/api/v1/tenant/context",
        payload
      );
      toast({
        title: "Company context saved",
        description: `${res.memoryEntries} memory entries updated.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast({
        title: "Failed to save context",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Company Context</h2>
          <p className="text-sm text-muted-foreground">
            Configure the context used by AI agents when generating value cases
            for your organisation. One item per line.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
        <div className="space-y-2">
          <Label htmlFor="products">Products / Solutions</Label>
          <Textarea
            id="products"
            placeholder="e.g. ValueOS&#10;Analytics Suite"
            value={products}
            onChange={(e) => setProducts(e.target.value)}
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="icps">Ideal Customer Profiles (ICPs)</Label>
          <Textarea
            id="icps"
            placeholder="e.g. Mid-market SaaS companies&#10;Enterprise financial services"
            value={icps}
            onChange={(e) => setIcps(e.target.value)}
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="competitors">Competitors</Label>
          <Textarea
            id="competitors"
            placeholder="e.g. Competitor A&#10;Competitor B"
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="personas">Buyer Personas</Label>
          <Textarea
            id="personas"
            placeholder="e.g. VP of Sales&#10;CFO&#10;Head of RevOps"
            value={personas}
            onChange={(e) => setPersonas(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="websiteUrl">Company Website URL</Label>
          <Input
            id="websiteUrl"
            type="url"
            placeholder="https://example.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save context"}
        </Button>
      </form>
    </div>
  );
}
