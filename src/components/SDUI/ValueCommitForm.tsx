import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { sanitizeString } from '../../security';

/**
 * KPI commitment data structure
 */
export interface CommitKPI {
  kpiName: string;
  baseline: number;
  target: number;
  unit?: string;
}

/**
 * Props for ValueCommitForm component
 */
export interface ValueCommitFormProps {
  /**
   * List of KPI names to configure
   */
  kpis: string[];

  /**
   * Callback when value commitment is submitted
   */
  onCommit: (committed: CommitKPI[], assumptions: string) => void;

  /**
   * Initial committed KPIs
   */
  initialCommitted?: CommitKPI[];

  /**
   * Initial assumptions text
   */
  initialAssumptions?: string;

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

  /**
   * Allow adding custom KPIs
   */
  allowCustomKPIs?: boolean;
}

/**
 * ValueCommitForm - Extended form for multiple KPI entries with assumptions
 *
 * Used in the Target stage to create comprehensive value commitments
 * with multiple KPIs and supporting assumptions.
 *
 * @example
 * ```tsx
 * <ValueCommitForm
 *   kpis={['Lead Conversion Rate', 'Manual Hours Reduced']}
 *   onCommit={(committed, assumptions) => {
 *     logger.debug('Committed KPIs:', committed);
 *     logger.debug('Assumptions:', assumptions);
 *   }}
 * />
 * ```
 */
export const ValueCommitForm: React.FC<ValueCommitFormProps> = ({
  kpis,
  onCommit,
  initialCommitted = [],
  initialAssumptions = '',
  loading = false,
  disabled = false,
  onCancel,
  showSuccess = false,
  allowCustomKPIs = false,
}) => {
  const sanitizeText = (value: string, maxLength = 200) =>
    sanitizeString(value, { maxLength, stripScripts: true }).sanitized;
  const [committed, setCommitted] = useState<CommitKPI[]>(initialCommitted);
  const [assumptions, setAssumptions] = useState(sanitizeText(initialAssumptions, 1500));
  const [currentKPI, setCurrentKPI] = useState<string>('');
  const [currentBaseline, setCurrentBaseline] = useState<number | ''>('');
  const [currentTarget, setCurrentTarget] = useState<number | ''>('');
  const [currentUnit, setCurrentUnit] = useState<string>('');
  const [customKPIName, setCustomKPIName] = useState<string>('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitted, setSubmitted] = useState(false);

  // Get available KPIs (not yet committed)
  const availableKPIs = kpis.filter(
    (kpi) => !committed.some((c) => c.kpiName === kpi)
  );

  const validateKPI = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    const kpiName = currentKPI === 'custom' ? customKPIName : currentKPI;

    if (!kpiName) {
      newErrors.kpi = 'Please select or enter a KPI name';
    }

    if (currentBaseline === '' || currentBaseline < 0) {
      newErrors.baseline = 'Baseline must be a positive number';
    }

    if (currentTarget === '' || currentTarget < 0) {
      newErrors.target = 'Target must be a positive number';
    }

    if (
      currentBaseline !== '' &&
      currentTarget !== '' &&
      currentTarget <= currentBaseline
    ) {
      newErrors.target = 'Target must be greater than baseline';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddKPI = () => {
    if (!validateKPI()) {
      return;
    }

    const kpiName = sanitizeText(currentKPI === 'custom' ? customKPIName : currentKPI, 120);

    const newKPI: CommitKPI = {
      kpiName,
      baseline: Number(currentBaseline),
      target: Number(currentTarget),
      unit: sanitizeText(currentUnit, 32) || undefined,
    };

    setCommitted([...committed, newKPI]);

    // Reset form
    setCurrentKPI('');
    setCurrentBaseline('');
    setCurrentTarget('');
    setCurrentUnit('');
    setCustomKPIName('');
    setErrors({});
  };

  const handleRemoveKPI = (index: number) => {
    setCommitted(committed.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (committed.length === 0) {
      setErrors({ form: 'Please add at least one KPI commitment' });
      return;
    }

    if (!assumptions.trim()) {
      setErrors({ assumptions: 'Please provide assumptions for your commitments' });
      return;
    }

    onCommit(committed, assumptions);
    setSubmitted(true);

    if (showSuccess) {
      setTimeout(() => setSubmitted(false), 3000);
    }
  };

  const calculateTotalImprovement = () => {
    if (committed.length === 0) return null;

    const improvements = committed.map((kpi) => {
      return ((kpi.target - kpi.baseline) / kpi.baseline) * 100;
    });

    const avgImprovement =
      improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;

    return avgImprovement.toFixed(1);
  };

  return (
    <form
      className="space-y-6 p-6 border border-border rounded-lg bg-card text-card-foreground shadow-beautiful-md"
      onSubmit={handleSubmit}
      data-testid="value-commit-form"
    >
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-bold text-foreground">Value Commitment</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define baseline and target values for key performance indicators
        </p>
      </div>

      {/* Success Message */}
      {submitted && showSuccess && (
        <div
          className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md"
          role="alert"
        >
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm text-green-800">
            Value commitment saved successfully!
          </span>
        </div>
      )}

      {/* Form Error */}
      {errors.form && (
        <div
          className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md"
          role="alert"
        >
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-sm text-red-800">{errors.form}</span>
        </div>
      )}

      {/* Add KPI Section */}
      <div className="space-y-4 p-4 bg-muted rounded-lg border border-border">
        <h3 className="text-sm font-semibold text-foreground">Add KPI</h3>

        {/* KPI Selection */}
        <div>
          <label htmlFor="kpi-select" className="block text-sm font-medium text-foreground">
            KPI Name
          </label>
          <select
            id="kpi-select"
            value={currentKPI}
            onChange={(e) => {
              setCurrentKPI(e.target.value);
              setErrors((prev) => ({ ...prev, kpi: undefined }));
            }}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 ${
              errors.kpi
                ? 'border-red-300 focus:ring-red-500'
                : 'border-border focus:ring-primary'
            }`}
            disabled={disabled || loading}
          >
            <option value="">Select a KPI...</option>
            {availableKPIs.map((kpi) => (
              <option key={kpi} value={kpi}>
                {kpi}
              </option>
            ))}
            {allowCustomKPIs && <option value="custom">+ Custom KPI</option>}
          </select>
          {errors.kpi && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.kpi}
            </p>
          )}
        </div>

        {/* Custom KPI Name */}
        {currentKPI === 'custom' && (
          <div>
            <label htmlFor="custom-kpi" className="block text-sm font-medium text-foreground">
              Custom KPI Name
            </label>
            <input
              id="custom-kpi"
              type="text"
              value={customKPIName}
              onChange={(e) => setCustomKPIName(sanitizeText(e.target.value, 120))}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter custom KPI name"
              disabled={disabled || loading}
            />
          </div>
        )}

        {/* Baseline and Target */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="kpi-baseline" className="block text-sm font-medium text-foreground">
              Baseline
            </label>
            <input
              id="kpi-baseline"
              type="number"
              step="any"
              value={currentBaseline}
              onChange={(e) => {
                setCurrentBaseline(e.target.value === '' ? '' : Number(e.target.value));
                setErrors((prev) => ({ ...prev, baseline: undefined }));
              }}
              className={`mt-1 block w-full px-3 py-2 border rounded-md bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 ${
                errors.baseline
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-border focus:ring-primary'
              }`}
              placeholder="Current value"
              disabled={disabled || loading}
            />
            {errors.baseline && (
              <p className="mt-1 text-sm text-red-600">{errors.baseline}</p>
            )}
          </div>

          <div>
            <label htmlFor="kpi-target" className="block text-sm font-medium text-foreground">
              Target
            </label>
            <input
              id="kpi-target"
              type="number"
              step="any"
              value={currentTarget}
              onChange={(e) => {
                setCurrentTarget(e.target.value === '' ? '' : Number(e.target.value));
                setErrors((prev) => ({ ...prev, target: undefined }));
              }}
              className={`mt-1 block w-full px-3 py-2 border rounded-md bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 ${
                errors.target
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-border focus:ring-primary'
              }`}
              placeholder="Target value"
              disabled={disabled || loading}
            />
            {errors.target && (
              <p className="mt-1 text-sm text-red-600">{errors.target}</p>
            )}
          </div>
        </div>

        {/* Unit */}
        <div>
          <label htmlFor="kpi-unit" className="block text-sm font-medium text-foreground">
            Unit (optional)
          </label>
          <input
            id="kpi-unit"
            type="text"
            value={currentUnit}
            onChange={(e) => setCurrentUnit(sanitizeText(e.target.value, 32))}
            className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g., %, hours, USD"
            disabled={disabled || loading}
          />
        </div>

        {/* Add Button */}
        <button
          type="button"
          onClick={handleAddKPI}
          disabled={disabled || loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-light-blue-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add KPI
        </button>
      </div>

      {/* Committed KPIs List */}
      {committed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Committed KPIs ({committed.length})
          </h3>
          <div className="space-y-2">
            {committed.map((kpi, index) => {
              const improvement = (((kpi.target - kpi.baseline) / kpi.baseline) * 100).toFixed(
                1
              );
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{kpi.kpiName}</p>
                    <p className="text-sm text-muted-foreground">
                      Baseline: {kpi.baseline}
                      {kpi.unit} → Target: {kpi.target}
                      {kpi.unit}
                      <span className="ml-2 text-blue-700 font-medium">
                        (+{improvement}%)
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveKPI(index)}
                    disabled={disabled || loading}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                    aria-label={`Remove ${kpi.kpiName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          {calculateTotalImprovement() && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-900">
                <span className="font-semibold">Average Improvement:</span>{' '}
                <span className="font-bold text-green-700">
                  {calculateTotalImprovement()}%
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Assumptions */}
      <div>
        <label htmlFor="assumptions" className="block text-sm font-medium text-foreground">
          Assumptions <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          Document the key assumptions underlying these commitments
        </p>
        <textarea
          id="assumptions"
          value={assumptions}
          onChange={(e) => {
            setAssumptions(sanitizeText(e.target.value, 1500));
            setErrors((prev) => ({ ...prev, assumptions: undefined }));
          }}
          className={`mt-2 block w-full px-3 py-2 border rounded-md bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 ${
            errors.assumptions
              ? 'border-red-300 focus:ring-red-500'
              : 'border-border focus:ring-primary'
          }`}
          rows={4}
          placeholder="e.g., Assumes 20% increase in marketing spend, no major market disruptions, current team capacity maintained..."
          disabled={disabled || loading}
          required
        />
        {errors.assumptions && (
          <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.assumptions}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={disabled || loading || committed.length === 0}
          className="flex-1 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-md shadow-light-blue-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Committing...' : 'Commit Value'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-3 border border-border text-muted-foreground font-semibold rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};
