/**
 * CreateOrganization
 *
 * Shown when an authenticated user has no tenants. Collects org name and
 * tier, then calls provisionTenant to set up the full tenant stack
 * (org record, settings, teams, roles, billing, usage tracking).
 */

import { ArrowRight, Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";
import {
  provisionTenant,
  type TenantConfig,
  type TenantTier,
} from "@/services/TenantProvisioning";

const orgNameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(64, "Name must be 64 characters or fewer")
  .regex(/^[a-zA-Z0-9\s\-_.]+$/, "Only letters, numbers, spaces, hyphens, dots, and underscores");

const tiers: { value: TenantTier; label: string; description: string }[] = [
  { value: "free", label: "Free", description: "Up to 3 users, 5 projects" },
  { value: "starter", label: "Starter", description: "Up to 10 users, 25 projects" },
  { value: "professional", label: "Professional", description: "Up to 50 users, unlimited projects" },
  { value: "enterprise", label: "Enterprise", description: "Unlimited users, SSO, dedicated support" },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function CreateOrganization() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshTenants } = useTenant();

  const [name, setName] = useState("");
  const [tier, setTier] = useState<TenantTier>("free");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = orgNameSchema.safeParse(name.trim());
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid name");
      return;
    }

    if (!user?.id || !user?.email) {
      setError("You must be signed in to create an organization.");
      return;
    }

    setIsSubmitting(true);

    try {
      const orgId = crypto.randomUUID();
      const config: TenantConfig = {
        organizationId: orgId,
        name: parsed.data,
        tier,
        ownerId: user.id,
        ownerEmail: user.email,
        settings: {
          slug: generateSlug(parsed.data),
          brandColor: "#18C3A5",
        },
      };

      const result = await provisionTenant(config);

      if (!result.success) {
        setError(result.errors.join("; ") || "Provisioning failed. Please try again.");
        return;
      }

      // Refresh tenant list so TenantContext picks up the new org
      await refreshTenants();

      // Navigate to onboarding
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Create your organization</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Set up your workspace to start building value cases.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Org name */}
          <div>
            <label htmlFor="org-name" className="block text-sm font-medium text-zinc-700 mb-1.5">
              Organization name
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              autoFocus
              disabled={isSubmitting}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
            />
          </div>

          {/* Tier selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Plan</label>
            <div className="grid grid-cols-2 gap-3">
              {tiers.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setTier(t.value)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    tier === t.value
                      ? "border-zinc-900 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
                    isSubmitting && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className={cn("text-xs mt-0.5", tier === t.value ? "text-zinc-300" : "text-zinc-400")}>
                    {t.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || name.trim().length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create organization
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateOrganization;
