/**
 * WarmthThresholdSlider — Configuration UI for custom warmth thresholds
 *
 * Phase 5.2: Custom Warmth Thresholds
 *
 * Dual-range slider with bounded min/max, real-time preview,
 * and reclassification impact calculation.
 */

import { useCallback, useMemo, useState } from "react";

import { Slider } from "@/components/ui/slider";
import type { WarmthOverrides } from "@shared/domain/Warmth";

import {
  clampThreshold,
  getThresholdLabel,
  THRESHOLD_BOUNDS,
  type GlobalWarmthPreferences,
} from "@/lib/warmth-thresholds";

interface WarmthThresholdSliderProps {
  /** Label for the slider */
  label: string;
  /** Which threshold this controls */
  type: "firmMinimum" | "verifiedMinimum";
  /** Current value */
  value: number;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Optional preview cases to show reclassification impact */
  previewCases?: Array<{
    name: string;
    confidence: number;
    currentWarmth: "forming" | "firm" | "verified";
    sagaState: string;
  }>;
  /** Whether disabled */
  disabled?: boolean;
}

export function WarmthThresholdSlider({
  label,
  type,
  value,
  onChange,
  previewCases,
  disabled = false,
}: WarmthThresholdSliderProps): JSX.Element {
  const bounds = THRESHOLD_BOUNDS[type];
  const [localValue, setLocalValue] = useState(value);

  // Calculate reclassifications
  const reclassifications = useMemo(() => {
    if (!previewCases?.length) return [];

    return previewCases.filter((c) => {
      const newWarmth = deriveWarmthForPreview(c.confidence, type, localValue);
      return newWarmth !== c.currentWarmth;
    });
  }, [previewCases, localValue, type]);

  const handleChange = useCallback(
    (values: number[]) => {
      const newValue = clampThreshold(values[0] ?? bounds.default, type);
      setLocalValue(newValue);
      onChange(newValue);
    },
    [bounds.default, onChange, type]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm text-gray-500">
          {localValue.toFixed(2)} — {getThresholdLabel(localValue)}
        </span>
      </div>

      <Slider
        value={[localValue]}
        min={bounds.min}
        max={bounds.max}
        step={0.05}
        onValueChange={handleChange}
        disabled={disabled}
        className="w-full"
      />

      <div className="flex justify-between text-xs text-gray-400">
        <span>{bounds.min}</span>
        <span>Default: {bounds.default}</span>
        <span>{bounds.max}</span>
      </div>

      {reclassifications.length > 0 && (
        <p className="text-xs text-amber-600 mt-2">
          {reclassifications.length} case(s) would reclassify
        </p>
      )}

      {reclassifications.length > 0 && (
        <ul className="text-xs text-gray-500 mt-1 space-y-1">
          {reclassifications.slice(0, 3).map((c) => (
            <li key={c.name}>
              {c.name}: {c.currentWarmth} →{" "}
              {deriveWarmthForPreview(c.confidence, type, localValue)}
            </li>
          ))}
          {reclassifications.length > 3 && (
            <li>...and {reclassifications.length - 3} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Derive warmth for preview purposes (without saga state context).
 */
function deriveWarmthForPreview(
  confidence: number,
  thresholdType: "firmMinimum" | "verifiedMinimum",
  value: number
): "forming" | "firm" | "verified" {
  if (thresholdType === "verifiedMinimum") {
    return confidence >= value ? "verified" : confidence >= THRESHOLD_BOUNDS.firmMinimum.default ? "firm" : "forming";
  }
  // For firmMinimum preview
  return confidence >= value ? "firm" : "forming";
}

/**
 * Warmth Threshold Configuration Panel
 *
 * Full configuration UI for both global and per-case thresholds.
 */
interface WarmthThresholdPanelProps {
  /** Current thresholds */
  thresholds: {
    firmMinimum: number;
    verifiedMinimum: number;
  };
  /** Callback when thresholds change */
  onChange: (thresholds: { firmMinimum: number; verifiedMinimum: number }) => void;
  /** User ID for audit logging */
  userId: string;
  /** Optional case ID (if per-case override) */
  caseId?: string;
  /** Preview cases for impact calculation */
  previewCases?: WarmthThresholdSliderProps["previewCases"];
  /** Whether this is a per-case override */
  isPerCase?: boolean;
}

export function WarmthThresholdPanel({
  thresholds,
  onChange,
  userId,
  caseId,
  previewCases,
  isPerCase = false,
}: WarmthThresholdPanelProps): JSX.Element {
  const [localThresholds, setLocalThresholds] = useState(thresholds);

  const handleFirmChange = useCallback(
    (value: number) => {
      const newThresholds = { ...localThresholds, firmMinimum: value };
      setLocalThresholds(newThresholds);
      onChange(newThresholds);
    },
    [localThresholds, onChange]
  );

  const handleVerifiedChange = useCallback(
    (value: number) => {
      const newThresholds = { ...localThresholds, verifiedMinimum: value };
      setLocalThresholds(newThresholds);
      onChange(newThresholds);
    },
    [localThresholds, onChange]
  );

  return (
    <div className="space-y-6 p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Warmth Thresholds
        </h3>
        {isPerCase && (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
            Per-Case Override
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500">
        Adjust when cases transition between forming, firm, and verified states.
        Changes {isPerCase ? "apply to this case only" : "affect all your cases"}.
      </p>

      <WarmthThresholdSlider
        label="Firm Threshold"
        type="firmMinimum"
        value={localThresholds.firmMinimum}
        onChange={handleFirmChange}
        previewCases={previewCases}
      />

      <WarmthThresholdSlider
        label="Verified Threshold"
        type="verifiedMinimum"
        value={localThresholds.verifiedMinimum}
        onChange={handleVerifiedChange}
        previewCases={previewCases}
      />

      {isPerCase && (
        <div className="text-xs text-gray-400 mt-4">
          Override by: {userId} • Case: {caseId}
        </div>
      )}
    </div>
  );
}
