import React from "react";
import { Target, Send } from "lucide-react";

export interface KPIDefinition {
  id: string;
  label: string;
  unit?: string;
  type: "number" | "currency" | "percentage" | "text";
  min?: number;
  max?: number;
  target?: number;
}

export interface KPIFormProps {
  kpis: KPIDefinition[];
  values?: Record<string, number | string>;
  onChange?: (kpiId: string, value: number | string) => void;
  onSubmit?: (values: Record<string, number | string>) => void;
  readOnly?: boolean;
  className?: string;
}

const unitSuffix: Record<string, string> = {
  currency: "$",
  percentage: "%",
};

function getInputType(kpiType: KPIDefinition["type"]): string {
  return kpiType === "text" ? "text" : "number";
}

export const KPIForm: React.FC<KPIFormProps> = ({
  kpis,
  values = {},
  onChange,
  onSubmit,
  readOnly = false,
  className = "",
}) => {
  const handleChange = (kpi: KPIDefinition, raw: string) => {
    if (!onChange) return;
    const value = kpi.type === "text" ? raw : Number(raw);
    onChange(kpi.id, value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(values);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-card border border-border rounded-lg p-4 space-y-4 ${className}`}
    >
      {kpis.map((kpi) => {
        const currentValue = values[kpi.id] ?? "";
        const suffix = kpi.unit ?? unitSuffix[kpi.type] ?? "";
        const hasTarget = kpi.target !== undefined;

        return (
          <div key={kpi.id} className="space-y-1.5">
            <label
              htmlFor={`kpi-${kpi.id}`}
              className="flex items-center justify-between text-sm font-medium text-foreground"
            >
              <span>{kpi.label}</span>
              {hasTarget && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Target className="w-3 h-3" />
                  Target: {kpi.target}{suffix}
                </span>
              )}
            </label>
            <div className="relative">
              {kpi.type === "currency" && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
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
                className={`w-full rounded border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
                  kpi.type === "currency" ? "pl-7" : ""
                } ${readOnly ? "opacity-60 cursor-not-allowed" : ""}`}
                placeholder={`Enter ${kpi.label.toLowerCase()}`}
              />
              {suffix && kpi.type !== "currency" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {suffix}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {!readOnly && onSubmit && (
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          Submit
        </button>
      )}
    </form>
  );
};
KPIForm.displayName = "KPIForm";

export default KPIForm;
