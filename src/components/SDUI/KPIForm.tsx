import React, { useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { sanitizeString } from '../../security';

/**
 * Props for KPIForm component
 */
export interface KPIFormProps {
  /**
   * Name of the KPI being configured
   */
  kpiName: string;

  /**
   * Callback when form is submitted
   */
  onSubmit: (baseline: number, target: number) => void;

  /**
   * Initial baseline value
   */
  initialBaseline?: number;

  /**
   * Initial target value
   */
  initialTarget?: number;

  /**
   * Optional description of the KPI
   */
  description?: string;

  /**
   * Unit of measurement (e.g., '%', 'hours', 'USD')
   */
  unit?: string;

  /**
   * Whether the form is in loading state
   */
  loading?: boolean;

  /**
   * Whether the form is disabled
   */
  disabled?: boolean;

  /**
   * Callback when form is cancelled
   */
  onCancel?: () => void;

  /**
   * Show success message after submission
   */
  showSuccess?: boolean;
}

/**
 * KPIForm - A form for entering baseline and target values for a KPI
 *
 * Used in the Target stage to define value commitments with baseline
 * and target metrics.
 *
 * @example
 * ```tsx
 * <KPIForm
 *   kpiName="Lead Conversion Rate"
 *   unit="%"
 *   onSubmit={(baseline, target) => {
 *     logger.debug(`Baseline: ${baseline}, Target: ${target}`);
 *   }}
 * />
 * ```
 */
export const KPIForm: React.FC<KPIFormProps> = ({
  kpiName,
  onSubmit,
  initialBaseline,
  initialTarget,
  description,
  unit,
  loading = false,
  disabled = false,
  onCancel,
  showSuccess = false,
}) => {
  const safeKpiName = sanitizeString(kpiName, { maxLength: 120, stripScripts: true }).sanitized;
  const safeUnit = unit ? sanitizeString(unit, { maxLength: 16, stripScripts: true }).sanitized : unit;
  const [baseline, setBaseline] = useState<number | ''>(initialBaseline ?? '');
  const [target, setTarget] = useState<number | ''>(initialTarget ?? '');
  const [errors, setErrors] = useState<{ baseline?: string; target?: string }>({});
  const [submitted, setSubmitted] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: { baseline?: string; target?: string } = {};

    if (baseline === '' || baseline < 0) {
      newErrors.baseline = 'Baseline must be a positive number';
    }

    if (target === '' || target < 0) {
      newErrors.target = 'Target must be a positive number';
    }

    if (baseline !== '' && target !== '' && target <= baseline) {
      newErrors.target = 'Target must be greater than baseline';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (baseline !== '' && target !== '') {
      onSubmit(Number(baseline), Number(target));
      setSubmitted(true);

      // Reset success message after 3 seconds
      if (showSuccess) {
        setTimeout(() => setSubmitted(false), 3000);
      }
    }
  };

  const handleBaselineChange = (value: string) => {
    setBaseline(value === '' ? '' : Number(value));
    setErrors((prev) => ({ ...prev, baseline: undefined }));
  };

  const handleTargetChange = (value: string) => {
    setTarget(value === '' ? '' : Number(value));
    setErrors((prev) => ({ ...prev, target: undefined }));
  };

  const improvement =
    baseline !== '' && target !== '' && baseline > 0
      ? (((Number(target) - Number(baseline)) / Number(baseline)) * 100).toFixed(1)
      : null;

  return (
    <form
      className="space-y-4 p-4 border border-border rounded-lg bg-card text-card-foreground shadow-beautiful-md"
      onSubmit={handleSubmit}
      data-testid="kpi-form"
    >
      {/* Header */}
      <div className="border-b border-border pb-3">
        <h3 className="text-lg font-bold text-foreground">{safeKpiName}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>

      {/* Success Message */}
      {submitted && showSuccess && (
        <div
          className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md"
          role="alert"
        >
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm text-green-800">KPI values saved successfully!</span>
        </div>
      )}

      {/* Baseline Input */}
      <div>
        <label htmlFor={`baseline-${kpiName}`} className="block text-sm font-medium text-foreground">
          Baseline {safeUnit && `(${safeUnit})`}
        </label>
        <input
          id={`baseline-${safeKpiName}`}
          type="number"
          step="any"
          value={baseline}
          onChange={(e) => handleBaselineChange(e.target.value)}
          className={`mt-1 block w-full px-3 py-2 border rounded-md bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 ${
            errors.baseline
              ? 'border-red-300 focus:ring-red-500'
              : 'border-border focus:ring-primary'
          }`}
          placeholder="Enter current baseline value"
          disabled={disabled || loading}
          required
          aria-invalid={!!errors.baseline}
          aria-describedby={errors.baseline ? `baseline-error-${safeKpiName}` : undefined}
        />
        {errors.baseline && (
          <p
            id={`baseline-error-${safeKpiName}`}
            className="mt-1 text-sm text-red-600 flex items-center gap-1"
          >
            <AlertCircle className="h-4 w-4" />
            {errors.baseline}
          </p>
        )}
      </div>

      {/* Target Input */}
      <div>
        <label htmlFor={`target-${kpiName}`} className="block text-sm font-medium text-foreground">
          Target {safeUnit && `(${safeUnit})`}
        </label>
        <input
          id={`target-${safeKpiName}`}
          type="number"
          step="any"
          value={target}
          onChange={(e) => handleTargetChange(e.target.value)}
          className={`mt-1 block w-full px-3 py-2 border rounded-md bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 ${
            errors.target
              ? 'border-red-300 focus:ring-red-500'
              : 'border-border focus:ring-primary'
          }`}
          placeholder="Enter target value"
          disabled={disabled || loading}
          required
          aria-invalid={!!errors.target}
          aria-describedby={errors.target ? `target-error-${safeKpiName}` : undefined}
        />
        {errors.target && (
          <p
            id={`target-error-${safeKpiName}`}
            className="mt-1 text-sm text-red-600 flex items-center gap-1"
          >
            <AlertCircle className="h-4 w-4" />
            {errors.target}
          </p>
        )}
      </div>

      {/* Improvement Calculation */}
      {improvement !== null && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Expected Improvement:</span>{' '}
            <span className="font-bold text-blue-700">{improvement}%</span>
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={disabled || loading}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-light-blue-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Saving...' : 'Save KPI'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border border-border text-muted-foreground rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};
