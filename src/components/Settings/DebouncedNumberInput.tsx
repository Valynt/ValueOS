/**
 * Debounced Number Input Component
 * 
 * Sprint 2 Enhancement: Reusable debounced numeric input
 * Prevents excessive API calls while providing immediate UI feedback
 */

import React from 'react';
import { useDebouncedState } from '../../hooks/useDebounce';
import { AlertCircle, Loader2 } from 'lucide-react';

export interface DebouncedNumberInputProps {
  value: number;
  onChange: (value: number) => Promise<void> | void;
  label: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  debounceMs?: number;
  disabled?: boolean;
  error?: string;
  unit?: string;
  className?: string;
}

/**
 * Number input with built-in debouncing
 * 
 * @example
 * ```tsx
 * <DebouncedNumberInput
 *   value={sessionTimeout}
 *   onChange={(value) => updateSetting('organization.security.sessionTimeout', value)}
 *   label="Session Timeout"
 *   description="Session timeout in minutes"
 *   min={5}
 *   max={1440}
 *   unit="minutes"
 *   debounceMs={500}
 * />
 * ```
 */
export const DebouncedNumberInput: React.FC<DebouncedNumberInputProps> = ({
  value: externalValue,
  onChange,
  label,
  description,
  min,
  max,
  step = 1,
  debounceMs = 500,
  disabled = false,
  error,
  unit,
  className = '',
}) => {
  const [localValue, debouncedValue, setLocalValue] = useDebouncedState(
    externalValue,
    debounceMs
  );
  const [saving, setSaving] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Update local value when external value changes
  React.useEffect(() => {
    setLocalValue(externalValue);
  }, [externalValue, setLocalValue]);

  // Save when debounced value changes
  React.useEffect(() => {
    if (debouncedValue === externalValue) return;

    // Validate
    if (min !== undefined && debouncedValue < min) {
      setValidationError(`Minimum value is ${min}`);
      return;
    }
    if (max !== undefined && debouncedValue > max) {
      setValidationError(`Maximum value is ${max}`);
      return;
    }

    setValidationError(null);

    // Save
    const save = async () => {
      setSaving(true);
      try {
        await onChange(debouncedValue);
      } catch (err) {
        console.error('Failed to save setting:', err);
      } finally {
        setSaving(false);
      }
    };

    save();
  }, [debouncedValue, externalValue, onChange, min, max]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || 0;
    setLocalValue(newValue);
  };

  const displayError = error || validationError;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={label} className="block text-sm font-medium text-gray-700">
          {label}
          {saving && (
            <span className="ml-2 text-xs text-gray-500">
              <Loader2 className="inline h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
        </label>
        {unit && (
          <span className="text-sm text-gray-500">{unit}</span>
        )}
      </div>

      <input
        id={label}
        type="number"
        value={localValue}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border rounded-lg
          focus:outline-none focus:ring-2 transition-colors
          ${displayError
            ? 'border-red-300 focus:ring-red-500'
            : 'border-gray-300 focus:ring-blue-500'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
        `}
      />

      {description && !displayError && (
        <p className="text-xs text-gray-500">{description}</p>
      )}

      {displayError && (
        <p className="text-sm text-red-600 flex items-center">
          <AlertCircle className="h-4 w-4 mr-1" />
          {displayError}
        </p>
      )}

      {min !== undefined && max !== undefined && (
        <p className="text-xs text-gray-500">
          Range: {min} - {max}
        </p>
      )}
    </div>
  );
};
