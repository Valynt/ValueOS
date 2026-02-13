/**
 * KPIForm
 *
 * Form for entering KPI values with inline validation, progress tracking,
 * and field-level error prevention.
 *
 * UX Principles:
 * - Error Prevention > Error Messages: disables submit until valid, shows range hints
 * - Immediate Feedback: inline validation on blur, progress bar for completion
 * - Golden Thread: carries target context alongside each field
 * - Accessibility: aria-invalid, aria-describedby for errors, proper label association
 */

import React, { useMemo } from "react";
import { Target, Send, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KPIDefinition {
  id: string;
  label: string;
  unit?: string;
  type: "number" | "currency" | "percentage" | "text";
  min?: number;
  max?: number;
  target?: number;
  required?: boolean;
}

export interface KPIFormProps {
  kpis: KPIDefinition[];
  values?: Record<string, number | string>;
  errors?: Record<string, string>;
  onChange?: (kpiId: string, value: number | string) => void;
  onSubmit?: (values: Record<string, number | string>) => void;
  readOnly?: boolean;
  loading?: boolean;
  className?: string;
}

const unitSuffix: Record<string, string> = {
  currency: "$",
  percentage: "%",
};

function getInputType(kpiType: KPIDefinition["type"]): string {
  return kpiType === "text" ? "text" : "number";
}

function validateField(kpi: KPIDefinition, value: number | string | undefined): string | null {
  if (kpi.required && (value === undefined || value === "")) {
    return `${kpi.label} is required`;
  }
  if (kpi.type !== "text" && value !== undefined && value !== "") {
    const num = Number(value);
    if (isNaN(num)) return "Must be a number";
    if (kpi.min !== undefined && num < kpi.min) return `Minimum is ${kpi.min}`;
    if (kpi.max !== undefined && num > kpi.max) return `Maximum is ${kpi.max}`;
  }
  return null;
}

export const KPIForm: React.FC<KPIFormProps> = ({
  kpis,
  values = {},
  errors: externalErrors = {},
  onChange,
  onSubmit,
  readOnly = false,
  loading = false,
  className = "",
}) => {
  // Compute completion progress
  const { filledCount, totalRequired, allValid } = useMemo(() => {
    let filled = 0;
    let required = 0;
    let valid = true;

    for (const kpi of kpis) {
      const val = values[kpi.id];
      const hasValue = val !== undefined && val !== "";
      if (hasValue) filled++;
      if (kpi.required) {
        required++;
        if (!hasValue) valid = false;
      }
      const err = validateField(kpi, val);
      if (err && hasValue) valid = false;
    }

    return { filledCount: filled, totalRequired: required, allValid: valid };
  }, [kpis, values]);

  const progress = kpis.length > 0 ? (filledCount / kpis.length) * 100 : 0;
  const canSubmit = allValid && !readOnly && !loading;

  const handleChange = (kpi: KPIDefinition, raw: string) => {
    if (!onChange) return;
    const value = kpi.type === "text" ? raw : (raw === "" ? "" : Number(raw));
    onChange(kpi.id, value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) onSubmit?.(values);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("bg-card border border-border rounded-lg p-4 space-y-4", className)}
      noValidate
    >
      {/* Completion progress */}
      {kpis.length > 1 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filledCount} of {kpis.length} fields completed</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* KPI fields */}
      {kpis.map((kpi) => {
        const currentValue = values[kpi.id] ?? "";
        const suffix = kpi.unit ?? unitSuffix[kpi.type] ?? "";
        const hasTarget = kpi.target !== undefined;
        const inlineError = externalErrors[kpi.id] || (currentValue !== "" ? validateField(kpi, currentValue) : null);
        const errorId = `kpi-error-${kpi.id}`;
        const hintId = `kpi-hint-${kpi.id}`;

        return (
          <div key={kpi.id} className="space-y-1.5">
            <label
              htmlFor={`kpi-${kpi.id}`}
              className="flex items-center justify-between text-sm font-medium text-foreground"
            >
              <span>
                {kpi.label}
                {kpi.required && <span className="text-destructive ml-0.5">*</span>}
              </span>
              {hasTarget && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Target className="w-3 h-3" />
                  Target: {kpi.target}{suffix}
                </span>
              )}
            </label>
            <div className="relative">
              {kpi.type === "currency" && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>
                  $
                </span>
              )}
              <input
                id={`kpi-${kpi.id}`}
                type={getInputType(kpi.type)}
                value={currentValue}
                onChange={(e) => handleChange(kpi, e.target.value)}
                readOnly={readOnly}
                min={kpi.min}
                max={kpi.max}
                step={kpi.type === "percentage" ? "0.1" : undefined}
                required={kpi.required}
                aria-invalid={!!inlineError}
                aria-describedby={cn(inlineError && errorId, (kpi.min !== undefined || kpi.max !== undefined) && hintId)}
                className={cn(
                  "w-full rounded-md border bg-secondary/50 px-3 py-2 text-sm text-foreground",
                  "placeholder:text-muted-foreground transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-ring",
                  kpi.type === "currency" && "pl-7",
                  readOnly && "opacity-60 cursor-not-allowed",
                  inlineError
                    ? "border-destructive focus:ring-destructive"
                    : "border-border"
                )}
                placeholder={`Enter ${kpi.label.toLowerCase()}`}
              />
              {suffix && kpi.type !== "currency" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>
                  {suffix}
                </span>
              )}
            </div>

            {/* Range hint */}
            {(kpi.min !== undefined || kpi.max !== undefined) && !inlineError && (
              <p id={hintId} className="text-xs text-muted-foreground">
                {kpi.min !== undefined && kpi.max !== undefined
                  ? `Range: ${kpi.min}–${kpi.max}`
                  : kpi.min !== undefined
                    ? `Minimum: ${kpi.min}`
                    : `Maximum: ${kpi.max}`}
              </p>
            )}

            {/* Inline error */}
            {inlineError && (
              <p id={errorId} className="flex items-center gap-1 text-xs text-destructive" role="alert">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {inlineError}
              </p>
            )}
          </div>
        );
      })}

      {/* Submit */}
      {!readOnly && onSubmit && (
        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              Submit
            </>
          )}
        </button>
      )}
    </form>
  );
};
KPIForm.displayName = "KPIForm";

export default KPIForm;
