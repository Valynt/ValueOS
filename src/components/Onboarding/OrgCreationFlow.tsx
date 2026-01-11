/**
 * OrgCreationFlow Component
 *
 * Explicit multi-tenant organization setup during onboarding.
 * Persists tenant ID and triggers safety warning if work is unsaved.
 * Part of P0 release-critical items.
 */

import { useState, useCallback } from "react";
import { Building2, Users, Globe, ArrowRight, Check, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface OrgFormData {
  name: string;
  slug: string;
  industry?: string;
  size?: string;
  website?: string;
}

interface OrgCreationFlowProps {
  onComplete: (org: OrgFormData) => Promise<void>;
  onSkip?: () => void;
  initialData?: Partial<OrgFormData>;
  className?: string;
}

type Step = "info" | "team" | "confirm";

const INDUSTRIES = [
  "Technology",
  "Financial Services",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Professional Services",
  "Other",
];

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

export function OrgCreationFlow({
  onComplete,
  onSkip,
  initialData,
  className,
}: OrgCreationFlowProps) {
  const [step, setStep] = useState<Step>("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<OrgFormData>({
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    industry: initialData?.industry || "",
    size: initialData?.size || "",
    website: initialData?.website || "",
  });

  // Generate slug from name
  const generateSlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
  }, []);

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Organization name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onComplete(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = formData.name.trim().length >= 2;

  return (
    <div className={cn("max-w-lg mx-auto", className)}>
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {(["info", "team", "confirm"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step === s
                  ? "bg-primary text-white"
                  : i < ["info", "team", "confirm"].indexOf(step)
                    ? "bg-green-500 text-white"
                    : "bg-gray-800 text-gray-500"
              )}
            >
              {i < ["info", "team", "confirm"].indexOf(step) ? (
                <Check className="w-4 h-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && (
              <div
                className={cn(
                  "w-12 h-0.5 mx-1",
                  i < ["info", "team", "confirm"].indexOf(step) ? "bg-green-500" : "bg-gray-800"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        {step === "info" && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-white">Create Your Organization</h2>
              <p className="text-gray-400 mt-1">
                Set up your workspace to start building value models
              </p>
            </div>

            {/* Organization name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Organization Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Corporation"
                className={cn(
                  "w-full px-4 py-3 rounded-lg",
                  "bg-gray-800 border border-gray-700 text-white placeholder-gray-500",
                  "focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none"
                )}
                autoFocus
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">URL Slug</label>
              <div className="flex items-center">
                <span className="text-gray-500 text-sm mr-2">valueos.app/</span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: generateSlug(e.target.value) }))
                  }
                  placeholder="acme-corp"
                  className={cn(
                    "flex-1 px-4 py-3 rounded-lg",
                    "bg-gray-800 border border-gray-700 text-white placeholder-gray-500",
                    "focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none",
                    "font-mono text-sm"
                  )}
                />
              </div>
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Industry</label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData((prev) => ({ ...prev, industry: e.target.value }))}
                className={cn(
                  "w-full px-4 py-3 rounded-lg",
                  "bg-gray-800 border border-gray-700 text-white",
                  "focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none"
                )}
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            {/* Company size */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Company Size</label>
              <div className="grid grid-cols-2 gap-2">
                {COMPANY_SIZES.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, size: size.value }))}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm border transition-colors",
                      formData.size === size.value
                        ? "bg-primary/10 border-primary/50 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                    )}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "team" && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-white">Invite Your Team</h2>
              <p className="text-gray-400 mt-1">Add colleagues to collaborate on value models</p>
            </div>

            <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 text-center">
              <p className="text-gray-400 text-sm">
                You can invite team members after setup from Settings → Team
              </p>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Ready to Launch</h2>
              <p className="text-gray-400 mt-1">Review your organization details</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-500">Name</span>
                <span className="text-white font-medium">{formData.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-800">
                <span className="text-gray-500">URL</span>
                <span className="text-white font-mono text-sm">valueos.app/{formData.slug}</span>
              </div>
              {formData.industry && (
                <div className="flex justify-between py-2 border-b border-gray-800">
                  <span className="text-gray-500">Industry</span>
                  <span className="text-white">{formData.industry}</span>
                </div>
              )}
              {formData.size && (
                <div className="flex justify-between py-2 border-b border-gray-800">
                  <span className="text-gray-500">Size</span>
                  <span className="text-white">{formData.size} employees</span>
                </div>
              )}
            </div>

            {/* Warning about unsaved work */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200">
                Switching organizations later will prompt you to save any unsaved work.
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-800">
          {step === "info" ? (
            <button
              onClick={onSkip}
              className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
            >
              Skip for now
            </button>
          ) : (
            <button
              onClick={() => setStep(step === "confirm" ? "team" : "info")}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
          )}

          {step === "confirm" ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium",
                "bg-primary hover:bg-primary/90 text-white",
                "transition-colors",
                isSubmitting && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isSubmitting ? "Creating..." : "Create Organization"}
            </button>
          ) : (
            <button
              onClick={() => setStep(step === "info" ? "team" : "confirm")}
              disabled={!canProceed}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium",
                "transition-colors",
                canProceed
                  ? "bg-primary hover:bg-primary/90 text-white"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed"
              )}
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrgCreationFlow;
